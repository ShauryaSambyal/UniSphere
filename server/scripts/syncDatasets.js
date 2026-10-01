import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { fetchOpenDatasetRecords, writeSnapshot, upsertColleges } from '../services/datasetService.js';

/**
 * Refreshes the college directory from public open datasets.
 *
 *   npm run data:sync          → download + cache the snapshot only
 *   npm run data:sync -- --save → download + upsert into MongoDB (no wipe)
 *
 * Unlike the seed script this never deletes anything: it upserts by sourceKey,
 * so it is safe to run against a live database.
 */
async function main() {
  const shouldSave = process.argv.includes('--save');

  try {
    const payload = await fetchOpenDatasetRecords();
    const snapshotPath = await writeSnapshot(payload);

    console.log(`\nSnapshot written to ${snapshotPath}`);
    console.log(`Records: ${payload.colleges.length}`);
    for (const source of payload.meta.sources) {
      console.log(`- ${source.label}: ${source.ok ? `${source.rows} rows` : 'unavailable'}`);
    }

    if (!shouldSave) {
      console.log('\nPass --save to also upsert these colleges into MongoDB.');
      process.exit(0);
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform';
    await mongoose.connect(uri);
    const result = await upsertColleges(College, payload.colleges);
    console.log(`Database now holds ${result.total} open-data colleges (${result.inserted} new).`);
    await mongoose.disconnect();

    process.exit(0);
  } catch (error) {
    console.error('Dataset sync failed:', error.message);
    process.exit(1);
  }
}

main();
