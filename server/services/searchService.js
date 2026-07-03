import { algoliasearch } from 'algoliasearch';
import dotenv from 'dotenv';
import College from '../models/College.js';

dotenv.config();

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || '';
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY || '';
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'colleges';

let client = null;

if (ALGOLIA_APP_ID && ALGOLIA_API_KEY) {
  try {
    client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
  } catch (error) {
    console.error('Algolia client initialization failed:', error.message);
  }
} else {
  console.info('Algolia credentials missing in environment variables. Using MongoDB fallback search mode.');
}

/**
 * Ensures index settings are initialized in Algolia.
 */
async function initializeSearchIndex() {
  if (!client) return null;
  try {
    await client.setSettings({
      indexName: INDEX_NAME,
      indexSettings: {
        searchableAttributes: ['name', 'shortName', 'location.city', 'location.state', 'courses'],
        attributesToRetrieve: ['objectID', 'name', 'shortName', 'location', 'nirfRanking', 'instituteType', 'courses']
      }
    });
    console.log('Algolia index settings configured.');
    return true;
  } catch (error) {
    console.warn('Algolia settings update failed (normal if API key is not admin or search-only):', error.message);
    return null;
  }
}

/**
 * Add or update college in Algolia.
 */
export async function syncCollegeToSearch(college) {
  if (!client) return false;
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
    await client.saveObjects({
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
  if (!client) return false;
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
    await client.saveObjects({
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
  if (!client) return false;
  try {
    await client.deleteObject({
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

  if (client) {
    try {
      const searchRes = await client.search({
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
