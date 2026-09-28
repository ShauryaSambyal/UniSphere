import { algoliasearch } from 'algoliasearch';
import College from '../models/College.js';
import '../config/env.js';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || '';
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'colleges';

// Algolia issues a separate key per privilege level. Indexing needs the write
// key; queries only need the least-privileged search key. ALGOLIA_API_KEY is
// still honoured as a single-key fallback for both.
const ALGOLIA_WRITE_API_KEY =
  process.env.ALGOLIA_WRITE_API_KEY || process.env.ALGOLIA_API_KEY || '';
const ALGOLIA_SEARCH_API_KEY =
  process.env.ALGOLIA_SEARCH_API_KEY || process.env.ALGOLIA_API_KEY || '';

function createAlgoliaClient(apiKey, label) {
  if (!ALGOLIA_APP_ID || !apiKey) return null;
  try {
    return algoliasearch(ALGOLIA_APP_ID, apiKey);
  } catch (error) {
    console.error(`Algolia ${label} client initialization failed:`, error.message);
    return null;
  }
}

// The write client can add and delete records, so it must never be exposed to
// browser code or reused for public-facing queries.
const writeClient = createAlgoliaClient(ALGOLIA_WRITE_API_KEY, 'write');
const searchClient = createAlgoliaClient(ALGOLIA_SEARCH_API_KEY, 'search') || writeClient;

if (!writeClient || !searchClient) {
  console.info('Algolia credentials missing in environment variables. Using MongoDB fallback search mode.');
}

/**
 * Ensures index settings are initialized in Algolia.
 */
async function initializeSearchIndex() {
  if (!writeClient) return null;
  try {
    await writeClient.setSettings({
      indexName: INDEX_NAME,
      indexSettings: {
        searchableAttributes: ['name', 'shortName', 'location.city', 'location.state', 'courses'],
        attributesToRetrieve: ['objectID', 'name', 'shortName', 'location', 'nirfRanking', 'instituteType', 'courses']
      }
    });
    console.log('Algolia index settings configured.');
    return true;
  } catch (error) {
    console.warn('Algolia settings update failed (the write key may lack the editSettings privilege):', error.message);
    return null;
  }
}

/**
 * Add or update college in Algolia.
 */
export async function syncCollegeToSearch(college) {
  if (!writeClient) return false;
  try {
    const doc = {
      objectID: college._id.toString(), // Algolia requires objectID
      name: college.name,
      shortName: college.shortName || '',
      location: {
        address: college.location.address,
        city: college.location.city,
        state: college.location.state,
        district: college.location.district || '',
        pincode: college.location.pincode || ''
      },
      nirfRanking: college.nirfRanking,
      instituteType: college.instituteType,
      courses: college.courses || []
    };
    await writeClient.saveObjects({
      indexName: INDEX_NAME,
      objects: [doc]
    });
    console.log(`Synced "${college.name}" to Algolia search index.`);
    return true;
  } catch (error) {
    console.warn(`Algolia sync failed for "${college.name}":`, error.message);
    return false;
  }
}

/**
 * Add or update multiple colleges in Algolia in bulk.
 */
export async function syncAllCollegesToSearch(colleges) {
  if (!writeClient) return false;
  try {
    const docs = colleges.map(college => ({
      objectID: college._id.toString(),
      name: college.name,
      shortName: college.shortName || '',
      location: {
        address: college.location?.address || '',
        city: college.location?.city || '',
        state: college.location?.state || '',
        district: college.location?.district || '',
        pincode: college.location?.pincode || ''
      },
      nirfRanking: college.nirfRanking || college.ranking?.nirf || 999,
      instituteType: college.instituteType,
      courses: college.courses || []
    }));
    await writeClient.saveObjects({
      indexName: INDEX_NAME,
      objects: docs
    });
    console.log(`Successfully synced ${docs.length} colleges to Algolia index in bulk.`);
    return true;
  } catch (error) {
    console.warn(`Algolia bulk sync failed:`, error.message);
    return false;
  }
}

/**
 * Delete college from Algolia.
 */
export async function deleteCollegeFromSearch(collegeId) {
  if (!writeClient) return false;
  try {
    await writeClient.deleteObject({
      indexName: INDEX_NAME,
      objectID: collegeId.toString()
    });
    console.log(`Deleted collegeId "${collegeId}" from Algolia search index.`);
    return true;
  } catch (error) {
    console.warn(`Algolia deletion failed for collegeId "${collegeId}":`, error.message);
    return false;
  }
}

/**
 * Perform search queries.
 * Falls back to MongoDB text/regex matching if Algolia is not available.
 */
export async function searchColleges(queryText, limit = 10) {
  if (!queryText) {
    // Return top rankers as defaults
    return College.find({}).sort({ nirfRanking: 1 }).limit(limit);
  }

  if (searchClient) {
    try {
      const searchRes = await searchClient.search({
        requests: [
          {
            indexName: INDEX_NAME,
            query: queryText,
            hitsPerPage: limit
          }
        ]
      });

      const hits = searchRes.results?.[0]?.hits || [];

      if (hits.length > 0) {
        const ids = hits.map(h => h.objectID);
        const colleges = await College.find({ _id: { $in: ids } });

        // Retain search rankings order
        const orderMap = {};
        ids.forEach((id, idx) => {
          orderMap[id] = idx;
        });
        return colleges.sort((a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]);
      }
    } catch (error) {
      console.warn('Algolia search failed, using MongoDB fallback:', error.message);
    }
  }

  // MongoDB Regex Match Fallback
  const escapedQuery = queryText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'i');
  return College.find({
    $or: [
      { name: regex },
      { shortName: regex },
      { 'location.city': regex },
      { 'location.state': regex },
      { courses: regex }
    ]
  }).limit(limit);
}

// Trigger index configuration on load
initializeSearchIndex().catch(() => {});
