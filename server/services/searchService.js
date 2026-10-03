import { algoliasearch } from 'algoliasearch';
import College from '../models/College.js';
import '../config/env.js';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || '';
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'colleges';

const ALGOLIA_WRITE_API_KEY =
  process.env.ALGOLIA_WRITE_API_KEY || process.env.ALGOLIA_API_KEY || '';

const ALGOLIA_MAX_RECORDS = Number.parseInt(process.env.ALGOLIA_MAX_RECORDS, 10) || 4000;
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

const writeClient = createAlgoliaClient(ALGOLIA_WRITE_API_KEY, 'write');
const searchClient = createAlgoliaClient(ALGOLIA_SEARCH_API_KEY, 'search') || writeClient;

if (!writeClient || !searchClient) {
  console.info('Algolia credentials missing in environment variables. Using MongoDB fallback search mode.');
}

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

export async function syncCollegeToSearch(college) {
  if (!writeClient) return false;
  try {
    const doc = {
      objectID: college._id.toString(),
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

export async function syncAllCollegesToSearch(colleges) {
  if (!writeClient) return false;

  if (colleges.length > ALGOLIA_MAX_RECORDS) {
    console.warn(
      `Skipping the bulk Algolia sync: ${colleges.length} colleges exceeds ALGOLIA_MAX_RECORDS (${ALGOLIA_MAX_RECORDS}). ` +
      'Autocomplete will use the MongoDB search fallback. Raise ALGOLIA_MAX_RECORDS in server/.env if your Algolia plan allows it.'
    );
    return false;
  }

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

export async function clearSearchIndex() {
  if (!writeClient) return false;
  try {
    await writeClient.clearObjects({ indexName: INDEX_NAME });
    console.log('Cleared the Algolia search index.');
    return true;
  } catch (error) {
    console.warn('Algolia index clear failed:', error.message);
    return false;
  }
}

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

function matchScore(college, term) {
  const name = String(college.name || '').toLowerCase();
  const short = String(college.shortName || '').toLowerCase();

  if (short === term) return 0;
  if (name === term) return 1;

  if (name.startsWith(`${term} `)) return 2;
  if (short.startsWith(term)) return 3;
  if (name.startsWith(term)) return 4;
  if (name.includes(` ${term}`)) return 5;
  if (short.includes(term)) return 6;
  if (name.includes(term)) return 7;
  return 8;
}

export async function searchColleges(queryText, limit = 10) {
  if (!queryText) {

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

        if (colleges.length > 0) {

          const orderMap = {};
          ids.forEach((id, idx) => {
            orderMap[id] = idx;
          });
          return colleges.sort((a, b) => orderMap[a._id.toString()] - orderMap[b._id.toString()]);
        }
      }
    } catch (error) {
      console.warn('Algolia search failed, using MongoDB fallback:', error.message);
    }
  }

  const escapedQuery = queryText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'i');
  const matches = await College.find({
    $or: [
      { name: regex },
      { shortName: regex },
      { 'location.city': regex },
      { 'location.state': regex },
      { courses: regex }
    ]
  }).limit(limit * 4);

  const term = queryText.trim().toLowerCase();
  return matches
    .sort((a, b) => matchScore(a, term) - matchScore(b, term) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

initializeSearchIndex().catch(() => {});
