import '../config/env.js';
import { readNirfSnapshot, dcsFetchPlan, foldName } from '../services/nirfService.js';
import fs from 'fs/promises';
import path from 'path';

const snapshot = await readNirfSnapshot();
const plan = dcsFetchPlan(snapshot.institutes);
const cacheDir = path.join(process.cwd(), 'data/.nirf-cache/dcs');

let cached = 0;
let cachedWithPlacements = 0;
try {
  const files = (await fs.readdir(cacheDir)).filter((f) => f.endsWith('.json'));
  cached = files.length;
  for (const file of files) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(cacheDir, file), 'utf8'));
      if (parsed?.parsed?.placements?.length > 0) cachedWithPlacements += 1;
    } catch {}
  }
} catch {}

const planIds = new Set(plan.map((r) => r.nirfId));
const dcsKeys = Object.keys(snapshot.dcs || {});
const withPlacementBlocks = dcsKeys.filter((k) => (snapshot.dcs[k].placements || []).length > 0);

console.log(JSON.stringify({
  snapshotYear: snapshot.meta?.year,
  records: snapshot.institutes.length,
  ranked: snapshot.institutes.filter((r) => r.rank).length,
  withPdfUrl: snapshot.institutes.filter((r) => r.pdfUrl).length,
  uniqueCampusesInPlan: plan.length,
  planWithPdf: plan.filter((r) => r.pdfUrl).length,
  cacheFiles: cached,
  cachedWithPlacements,
  snapshotDcsKeys: dcsKeys.length,
  snapshotDcsWithPlacements: withPlacementBlocks.length
}, null, 2));

const missing = plan.filter((r) => !withPlacementBlocks.includes(`${foldName(r.name)}|${foldName(r.state)}`));
console.log('campuses in plan without placement blocks yet:', missing.length);
console.log(missing.slice(0, 15).map((r) => `${r.nirfId} ${r.category} r${r.rank} ${r.name}`).join('\n'));
