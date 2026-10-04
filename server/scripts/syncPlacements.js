import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import {
  fetchNirfRankings,
  dcsFetchPlan,
  fetchDcsData,
  readDcsCache,
  readNirfSnapshot,
  writeNirfSnapshot,
  buildNirfIndex,
  matchCollegeToNirf,
  computeNirfFields,
  foldName
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

const campusKeyOf = (record) => `${foldName(record.name)}|${foldName(record.state)}`;

async function fetchPlanDossiers(plan, { log, maxSeconds, limit, startedAt }) {
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

      if ((fetched + failed) % 25 === 0) {
        log(`  … ${fetched + failed}/${queue.length} DCS PDFs processed`);
      }
      await delay(150);
    }
  });

  await Promise.all(workers);
  log(`DCS fetch: ${fetched} fetched, ${failed} failed, ${skipped} deferred (time budget).`);
  return { fetched, failed, skipped };
}

async function mergeEdition(snapshot, edition, { log, maxSeconds, limit, startedAt }) {
  const { institutes } = await fetchNirfRankings({ year: edition, log });
  const plan = dcsFetchPlan(institutes);

  const snapshotKeys = new Set(Object.keys(snapshot.dcs || {}));
  const snapshotIds = new Set(
    Object.values(snapshot.dcs || {}).map((dossier) => dossier.nirfId).filter(Boolean)
  );
  const snapshotNameKeys = new Set(
    snapshot.institutes.map((record) => campusKeyOf(record))
  );

  const missing = plan.filter(
    (record) => !snapshotKeys.has(campusKeyOf(record)) && !snapshotIds.has(record.nirfId)
  );
  log(
    `NIRF ${edition}: ${institutes.length} ranking records, ${plan.length} ranked campuses, ` +
      `${missing.length} without a dossier in the snapshot.`
  );

  if (missing.length > 0) {
    await fetchPlanDossiers(missing, { log, maxSeconds, limit, startedAt });
  }

  const cache = await readDcsCache({ year: edition });
  let addedDossiers = 0;
  let addedRecords = 0;

  for (const record of plan) {
    const key = campusKeyOf(record);
    if (snapshotKeys.has(key)) continue;

    const cached = record.nirfId ? cache.get(record.nirfId) : null;
    if (!cached?.parsed) continue;

    snapshot.dcs[key] = {
      nirfId: record.nirfId,
      category: record.category,
      pdfUrl: record.pdfUrl,
      year: edition,
      fetchedAt: cached.fetchedAt,
      placements: cached.parsed.placements,
      strength: cached.parsed.strength,
      facultyCount: cached.parsed.facultyCount
    };
    snapshotKeys.add(key);
    if (record.nirfId) snapshotIds.add(record.nirfId);
    addedDossiers += 1;

    if (!snapshotNameKeys.has(key)) {
      const siblings = institutes.filter((entry) => campusKeyOf(entry) === key);
      const existingCategories = new Set(
        snapshot.institutes
          .filter((existing) => campusKeyOf(existing) === key)
          .map((existing) => existing.category)
      );
      for (const sibling of siblings) {
        if (existingCategories.has(sibling.category)) continue;
        snapshot.institutes.push({ ...sibling, edition });
        existingCategories.add(sibling.category);
        addedRecords += 1;
      }
      snapshotNameKeys.add(key);
    }

    await delay(60);
  }

  log(`NIRF ${edition} merged: +${addedDossiers} placement dossiers, +${addedRecords} ranking records.`);
  return { addedDossiers, addedRecords };
}

async function applySnapshot(snapshot, { log }) {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/college-platform';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const colleges = await College.find({}).lean();
  const index = buildNirfIndex(snapshot);
  const operations = [];

  let matched = 0;
  let withPlacements = 0;
  let improvedPlacements = 0;

  for (const college of colleges) {
    const campus = matchCollegeToNirf(college, index);
    if (!campus) continue;

    const fields = computeNirfFields(college, campus, snapshot);
    const $set = {};
    if (fields.nirfRanking) $set.nirfRanking = fields.nirfRanking;
    if (fields.nirf) $set.nirf = fields.nirf;
    if (fields.studentStrength) $set.studentStrength = fields.studentStrength;
    if (fields.studentCount) $set.studentCount = fields.studentCount;
    if (fields.facultyCount) $set.facultyCount = fields.facultyCount;

    if (fields.placementsNirf) {
      const existing = college.placements?.nirf;
      const existingYear = Number(existing?.year) || 0;
      const incomingYear = Number(fields.placementsNirf.year) || 0;
      if (!existing || incomingYear >= existingYear) {
        $set['placements.nirf'] = fields.placementsNirf;
        if (incomingYear > existingYear) improvedPlacements += 1;
      }
      withPlacements += 1;
    }

    if (Object.keys($set).length === 0) continue;

    operations.push({
      updateOne: {
        filter: { _id: college._id },
        update: { $set, $setOnInsert: { createdAt: new Date() } },
        upsert: false
      }
    });
    matched += 1;
  }

  if (operations.length > 0) {
    await College.bulkWrite(operations, { ordered: false });
  }

  const totalPlaced = await College.countDocuments({ 'placements.nirf': { $exists: true } });
  log(
    `Applied to ${matched}/${colleges.length} colleges; ${withPlacements} matched with placement dossiers ` +
      `(${improvedPlacements} upgraded to a newer edition). Colleges with placements now: ${totalPlaced}.`
  );

  await mongoose.disconnect();
  return { matched, withPlacements, totalPlaced };
}

async function main() {
  const log = (message) => console.log(message);
  const startedAt = Date.now();
  const maxSeconds = flagValue('--max-seconds', 600);
  const limit = flagValue('--limit', undefined);
  const shouldApply = hasFlag('--apply');
  const editionsArg = args.includes('--editions') ? args[args.indexOf('--editions') + 1] : '2024,2023';
  const editions = editionsArg
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));

  try {
    const snapshot = await readNirfSnapshot();
    if (!snapshot) throw new Error('No snapshot found — run `npm run data:nirf` first.');

    for (const edition of editions) {
      if (Date.now() - startedAt > maxSeconds * 1000) {
        log(`Time budget exhausted before NIRF ${edition} — rerun to continue.`);
        break;
      }
      if (snapshot.meta?.editions?.includes(edition) && !hasFlag('--refetch')) {
        log(`NIRF ${edition} already merged — use --refetch to re-fetch.`);
        continue;
      }

      await mergeEdition(snapshot, edition, { log, maxSeconds, limit, startedAt });

      snapshot.meta.editions = [...new Set([...(snapshot.meta.editions || [snapshot.meta.year]), edition])];
      snapshot.meta.counts = {
        records: snapshot.institutes.length,
        ranked: snapshot.institutes.filter((record) => record.rank).length,
        banded: snapshot.institutes.filter((record) => record.band).length,
        dcs: Object.keys(snapshot.dcs).length
      };
      await writeNirfSnapshot(snapshot);
      log(`Snapshot updated: ${JSON.stringify(snapshot.meta.counts)}`);
    }

    if (shouldApply) {
      await applySnapshot(snapshot, { log });
    } else {
      log('Snapshot updated. Run with --apply to write placement data to the database.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Placement sync failed:', error.message);
    process.exit(1);
  }
}

main();
