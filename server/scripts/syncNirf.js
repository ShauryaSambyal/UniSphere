import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import {
  detectLatestYear,
  dcsFetchPlan,
  fetchDcsData,
  fetchNirfRankings,
  readDcsCache,
  readNirfSnapshot,
  buildNirfSnapshot,
  buildNirfIndex,
  matchCollegeToNirf,
  computeNirfFields,
  writeNirfSnapshot
} from '../services/nirfService.js';

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const flagValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : fallback;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchDcsPlan(plan, { log, maxSeconds, limit }) {
  const startedAt = Date.now();
  const budgetMs = maxSeconds * 1000;
  const queue = typeof limit === 'number' ? plan.slice(0, limit) : plan;
  let cursor = 0;
  let fetched = 0;
  let failed = 0;
  let skipped = 0;

  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < queue.length) {
      if (Date.now() - startedAt > budgetMs) {
        skipped = queue.length - cursor;
        cursor = queue.length;
        break;
      }

      const index = cursor;
      cursor += 1;
      const record = queue[index];

      try {
        await fetchDcsData(record, { log });
        fetched += 1;
      } catch (error) {
        failed += 1;
        log(`  ! DCS ${record.nirfId} (${record.name}) failed: ${error.message}`);
      }

      if ((fetched + failed) % 50 === 0) {
        log(`  … ${fetched + failed}/${queue.length} DCS PDFs processed`);
      }
      await delay(120);
    }
  });

  await Promise.all(workers);

  log(`DCS fetch phase: ${fetched} fetched, ${failed} failed, ${skipped} deferred (time budget).`);
  return { fetched, failed, skipped };
}

async function applyToDatabase(snapshot, { log }) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform';
  await mongoose.connect(uri);

  const colleges = await College.find({}).lean();
  const index = buildNirfIndex(snapshot);
  const operations = [];

  let matched = 0;
  let withPlacements = 0;
  let exactRank = 0;

  for (const college of colleges) {
    const campus = matchCollegeToNirf(college, index);
    if (!campus) continue;

    const fields = computeNirfFields(college, campus, snapshot);
    const $set = {};
    if (fields.nirfRanking) $set.nirfRanking = fields.nirfRanking;
    if (fields.nirf) $set.nirf = fields.nirf;
    if (fields.placementsNirf) $set['placements.nirf'] = fields.placementsNirf;
    if (fields.studentStrength) $set.studentStrength = fields.studentStrength;
    if (fields.studentCount) $set.studentCount = fields.studentCount;
    if (fields.facultyCount) $set.facultyCount = fields.facultyCount;

    if (Object.keys($set).length === 0) continue;

    operations.push({
      updateOne: {
        filter: { _id: college._id },
        update: {
          $set,
          $setOnInsert: { createdAt: new Date() }
        },
        upsert: false
      }
    });

    matched += 1;
    if (fields.placementsNirf) withPlacements += 1;
    if (fields.nirf?.bestRank) exactRank += 1;
  }

  if (operations.length > 0) {
    await College.bulkWrite(operations, { ordered: false });
  }

  log(
    `Applied NIRF ${snapshot.meta?.year} to ${matched}/${colleges.length} colleges ` +
      `(${exactRank} with an exact rank, ${withPlacements} with placement dossiers).`
  );

  await mongoose.disconnect();
}

async function main() {
  const log = (message) => console.log(message);

  try {
    const fromSnapshot = hasFlag('--from-snapshot');
    const rankingsOnly = hasFlag('--rankings-only');
    const shouldApply = hasFlag('--apply');
    const maxSeconds = flagValue('--max-seconds', 420);
    const limit = flagValue('--limit', undefined);
    const year = flagValue('--year', undefined);

    let snapshot = fromSnapshot ? await readNirfSnapshot() : null;
    if (fromSnapshot && !snapshot) {
      throw new Error('No snapshot found — run `npm run data:nirf` first.');
    }

    if (!snapshot) {
      const edition = year || (await detectLatestYear({ log }));
      const { institutes } = await fetchNirfRankings({ year: edition, log });

      let dcsById = await readDcsCache();
      if (!rankingsOnly) {
        const plan = dcsFetchPlan(institutes);
        log(`DCS fetch plan: ${plan.length} unique campuses with a per-institute PDF.`);
        const outcome = await fetchDcsPlan(plan, { log, maxSeconds, limit });
        if (outcome.skipped > 0) {
          log('Some PDFs were deferred to respect the time budget — rerun to continue.');
        }
        dcsById = await readDcsCache();
      }

      snapshot = buildNirfSnapshot({ year: edition, institutes, dcsById, log });
      const snapshotPath = await writeNirfSnapshot(snapshot);
      log(`Snapshot written to ${snapshotPath}`);
    }

    if (shouldApply) {
      await applyToDatabase(snapshot, { log });
    }

    process.exit(0);
  } catch (error) {
    console.error('NIRF sync failed:', error.message);
    process.exit(1);
  }
}

main();
