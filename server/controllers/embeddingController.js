import College from '../models/College.js';
import { syncCollegeToVectorDb } from '../services/chromaService.js';
import { syncCollegeToSearch } from '../services/searchService.js';

/**
 * Re-indexes all colleges.
 * Generates embeddings, syncs to ChromaDB, and syncs to Meilisearch.
 */
export async function generateAllEmbeddings(req, res) {
  try {
    const colleges = await College.find({});
    
    if (colleges.length === 0) {
      return res.status(200).json({
        message: 'No colleges found in database to generate embeddings for.',
        processedCount: 0
      });
    }

    console.log(`Starting bulk embedding generation for ${colleges.length} colleges...`);
    let chromaSyncSuccess = 0;
    let searchSyncSuccess = 0;

    for (const college of colleges) {
      try {
        const cSynced = await syncCollegeToVectorDb(college);
        if (cSynced) chromaSyncSuccess++;
      } catch (err) {
        console.error(`Failed to sync vector db for ${college.name}:`, err.message);
      }

      try {
        const mSynced = await syncCollegeToSearch(college);
        if (mSynced) searchSyncSuccess++;
      } catch (err) {
        console.error(`Failed to sync Algolia search for ${college.name}:`, err.message);
      }
    }

    return res.json({
      message: 'Indexing completed',
      totalColleges: colleges.length,
      syncedToChroma: chromaSyncSuccess,
      syncedToSearch: searchSyncSuccess
    });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return res.status(500).json({
      message: 'Embedding generation pipeline failed',
      error: error.message
    });
  }
}
