import axios from 'axios';
import College from '../models/College.js';
import '../config/env.js';

const CHROMADB_HOST = process.env.CHROMADB_HOST || 'http://localhost:8000';
const COLLECTION_NAME = 'colleges_collection';

// Dynamic import of Transformers.js (Hugging Face) to run BAAI/bge-large-en-v1.5 in-process
let extractor = null;
let extractorPromise = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    try {
      console.log('Initializing @huggingface/transformers pipeline for BAAI/bge-large-en-v1.5...');
      const { pipeline } = await import('@huggingface/transformers');
      // Xenova/bge-large-en-v1.5 is the ONNX-ready port of BAAI/bge-large-en-v1.5
      extractor = await pipeline('feature-extraction', 'Xenova/bge-large-en-v1.5', {
        dtype: 'q8' // 8-bit quantized weights: smaller download, lower memory usage
      });
      console.log('BAAI/bge-large-en-v1.5 model loaded successfully.');
      return extractor;
    } catch (err) {
      console.error('Failed to load local embedding pipeline. Using seed-based mock embeddings.', err);
      extractor = null;
      return null;
    }
  })();

  return extractorPromise;
}

// The first embedding request downloads a ~330 MB ONNX model. A user request
// that arrives while that download is still running must not wait on it
// forever, so the pipeline init gets a bounded window. The download itself
// keeps running in the background and later requests reuse it once ready.
const EMBEDDING_INIT_TIMEOUT_MS = Number(process.env.EMBEDDING_INIT_TIMEOUT_MS) || 20000;

/**
 * Kick off the embedding pipeline load without blocking the caller.
 * Called once at server boot (only when ChromaDB is reachable) so the model
 * is warm before the first user query arrives.
 */
export async function warmUpEmbeddingPipeline() {
  if (extractor || extractorPromise) return;

  const online = await isChromaOnline();
  if (!online) return;

  console.log('Warming up local embedding pipeline in the background...');
  getExtractor().catch(() => {});
}

/**
 * Resolves with the extractor, or null when it is not ready within the init
 * timeout (still downloading or failed to load).
 */
async function getExtractorBounded() {
  if (extractor) return extractor;

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), EMBEDDING_INIT_TIMEOUT_MS);
  });

  const result = await Promise.race([getExtractor(), timeout]);
  clearTimeout(timer);
  return result;
}

/**
 * Generate a 1024-dimension embedding using BAAI/bge-large-en-v1.5.
 * Returns null when the local model is unavailable so callers can fall back
 * to MongoDB search rather than waiting on (or corrupting) the vector index.
 */
export async function getEmbedding(text) {
  try {
    const ext = await getExtractorBounded();
    if (!ext) {
      console.warn('Embedding model is not ready yet. Skipping vector embedding for:', text.substring(0, 40));
      return null;
    }

    const output = await ext(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding with @huggingface/transformers:', error.message);
    return null;
  }
}

/**
 * Checks connection to ChromaDB.
 */
async function isChromaOnline() {
  try {
    const res = await axios.get(`${CHROMADB_HOST}/api/v1/heartbeat`, { timeout: 2000 });
    return res.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Get or create ChromaDB Collection ID.
 */
async function getCollectionId() {
  const online = await isChromaOnline();
  if (!online) return null;

  try {
    // Check if collection exists
    const res = await axios.get(`${CHROMADB_HOST}/api/v1/collections/${COLLECTION_NAME}`);
    return res.data.id;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // Create collection
      try {
        const createRes = await axios.post(`${CHROMADB_HOST}/api/v1/collections`, {
          name: COLLECTION_NAME,
          metadata: { "hnsw:space": "cosine" }
        });
        return createRes.data.id;
      } catch (err) {
        console.error('Failed to create ChromaDB collection:', err.message);
        return null;
      }
    }
    console.error('ChromaDB collection retrieval error:', error.message);
    return null;
  }
}

/**
 * Sync College documents into ChromaDB.
 * Format matching user specifications.
 */
export async function syncCollegeToVectorDb(college) {
  const docText = `College Name:
${college.name}

Location:
${college.location.city}, ${college.location.state}

Ranking:
${college.nirfRanking || 'N/A'}

Fees:
Tuition: ${college.fees?.tuition || 'N/A'}, Hostel: ${college.fees?.hostel || 'N/A'}

Placements:
Average Package ${college.placements?.averagePackage || 'N/A'}, Highest Package ${college.placements?.highestPackage || 'N/A'}

Courses:
${(college.courses || []).join('\n')}

Hostel:
${college.hostel?.available ? 'Available' : 'Not Available'}`;

  const colId = await getCollectionId();
  if (!colId) {
    console.log(`ChromaDB offline. Skipping vector sync for college: ${college.name}`);
    return false;
  }

  const embedding = await getEmbedding(docText);
  if (!embedding) {
    console.log(`Embedding model unavailable. Skipping vector sync for college: ${college.name}`);
    return false;
  }

  try {
    await axios.post(`${CHROMADB_HOST}/api/v1/collections/${colId}/upsert`, {
      ids: [college._id.toString()],
      embeddings: [embedding],
      metadatas: [{ collegeId: college._id.toString(), name: college.name }],
      documents: [docText]
    });
    console.log(`Successfully synced "${college.name}" to ChromaDB collection.`);
    return true;
  } catch (error) {
    console.error(`Failed to sync to ChromaDB: ${error.message}`);
    return false;
  }
}

/**
 * Remove college from Vector DB.
 */
export async function deleteCollegeFromVectorDb(collegeId) {
  const colId = await getCollectionId();
  if (!colId) return false;

  try {
    await axios.post(`${CHROMADB_HOST}/api/v1/collections/${colId}/delete`, {
      ids: [collegeId.toString()]
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete from ChromaDB: ${error.message}`);
    return false;
  }
}

/**
 * Keyword / ranking fallback used whenever ChromaDB or the embedding model is
 * unavailable. Never throws: worst case it returns the top-ranked colleges.
 */
async function searchMongoFallback(queryText, limit) {
  let matchedColleges = [];

  // 1. Try Mongoose text search for high relevance ranking
  try {
    matchedColleges = await College.find(
      { $text: { $search: queryText } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .populate('nearbyPlaces')
    .limit(limit);

    console.log(`Text search fallback found ${matchedColleges.length} matches.`);
  } catch (err) {
    console.warn('MongoDB text search index query failed. Falling back to regex keyword search:', err.message);
  }

  // 2. If text search returned nothing (or failed), use regex keyword search
  if (matchedColleges.length === 0) {
    const stopwords = new Set(['what', 'are', 'nearby', 'shops', 'in', 'on', 'at', 'of', 'to', 'by', 'is', 'an', 'it', 'the', 'for', 'and', 'or', 'if', 'this', 'that', 'with', 'about', 'from']);
    const cleanQuery = queryText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ');
    const keywords = cleanQuery
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !stopwords.has(w.toLowerCase()));

    const regexQueries = keywords.map(kw => new RegExp(kw, 'i'));

    if (regexQueries.length > 0) {
      matchedColleges = await College.find({
        $or: [
          { name: { $in: regexQueries } },
          { shortName: { $in: regexQueries } },
          { 'location.city': { $in: regexQueries } },
          { 'location.state': { $in: regexQueries } },
          { courses: { $in: regexQueries } },
          { facilities: { $in: regexQueries } }
        ]
      }).populate('nearbyPlaces').limit(limit);
    }
  }

  // 3. Absolute fallback to NIRF ranking top colleges
  if (matchedColleges.length === 0) {
    matchedColleges = await College.find({}).populate('nearbyPlaces').sort({ nirfRanking: 1 }).limit(limit);
  }

  return matchedColleges;
}

/**
 * RAG search: Generates query embedding, queries ChromaDB.
 * Falls back to Mongoose text/keyword search if ChromaDB is offline.
 *
 * ChromaDB is checked BEFORE computing an embedding: the first embedding call
 * downloads a large ONNX model, so it must never run when the vector store is
 * unreachable (which would hang the chat request for minutes).
 */
export async function searchVectorDb(queryText, limit = 5) {
  const colId = await getCollectionId();

  if (!colId) {
    console.warn('ChromaDB is offline. Performing fallback search on MongoDB colleges.');
    return searchMongoFallback(queryText, limit);
  }

  const queryEmbedding = await getEmbedding(queryText);
  if (!queryEmbedding) {
    console.warn('Embedding model unavailable. Performing fallback search on MongoDB colleges.');
    return searchMongoFallback(queryText, limit);
  }

  try {
    const queryRes = await axios.post(`${CHROMADB_HOST}/api/v1/collections/${colId}/query`, {
      query_embeddings: [queryEmbedding],
      n_results: limit
    });

    const collegeIds = queryRes.data.ids[0] || [];
    if (collegeIds.length === 0) return [];

    // Retrieve from MongoDB keeping ChromaDB similarity order and populating nearby places
    const colleges = await College.find({ _id: { $in: collegeIds } }).populate('nearbyPlaces');
    const orderMap = {};
    collegeIds.forEach((id, index) => {
      orderMap[id] = index;
    });

    return colleges.sort((a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]);
  } catch (error) {
    console.error('ChromaDB query failed. Falling back to MongoDB search.', error.message);
    return searchMongoFallback(queryText, limit);
  }
}
