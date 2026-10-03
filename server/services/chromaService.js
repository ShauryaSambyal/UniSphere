import axios from 'axios';
import College from '../models/College.js';
import '../config/env.js';

const CHROMADB_HOST = process.env.CHROMADB_HOST || 'http://localhost:8000';
const COLLECTION_NAME = 'colleges_collection';

let extractor = null;
let extractorPromise = null;

async function getExtractor() {
  if (extractor) return extractor;
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    try {
      console.log('Initializing @huggingface/transformers pipeline for BAAI/bge-large-en-v1.5...');
      const { pipeline } = await import('@huggingface/transformers');

      extractor = await pipeline('feature-extraction', 'Xenova/bge-large-en-v1.5', {
        dtype: 'q8'
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

const EMBEDDING_INIT_TIMEOUT_MS = Number(process.env.EMBEDDING_INIT_TIMEOUT_MS) || 20000;

export async function warmUpEmbeddingPipeline() {
  if (extractor || extractorPromise) return;

  const online = await isChromaOnline();
  if (!online) return;

  console.log('Warming up local embedding pipeline in the background...');
  getExtractor().catch(() => {});
}

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

async function isChromaOnline() {
  try {
    const res = await axios.get(`${CHROMADB_HOST}/api/v1/heartbeat`, { timeout: 2000 });
    return res.status === 200;
  } catch (error) {
    return false;
  }
}

async function getCollectionId() {
  const online = await isChromaOnline();
  if (!online) return null;

  try {

    const res = await axios.get(`${CHROMADB_HOST}/api/v1/collections/${COLLECTION_NAME}`);
    return res.data.id;
  } catch (error) {
    if (error.response && error.response.status === 404) {

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

async function searchMongoFallback(queryText, limit) {
  let matchedColleges = [];

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

  if (matchedColleges.length === 0) {
    matchedColleges = await College.find({}).populate('nearbyPlaces').sort({ nirfRanking: 1 }).limit(limit);
  }

  return matchedColleges;
}

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
