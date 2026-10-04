import '../config/env.js';
import { fetchNirfRankings, foldName, dcsFetchPlan, readDcsCache } from '../services/nirfService.js';

const log = (m) => console.log(m);
const { year, institutes } = await fetchNirfRankings({ year: 2024, log });

const ranked = institutes.filter((r) => r.rank);
const withPdf = institutes.filter((r) => r.pdfUrl);
const plan = dcsFetchPlan(institutes);

console.log(JSON.stringify({
  year,
  records: institutes.length,
  ranked: ranked.length,
  withPdf: withPdf.length,
  uniqueCampuses: plan.length
}, null, 2));

const existing = await readDcsCache();
const existingIds = new Set(existing.keys());
const existingKeys = new Set();
try {
  const snapshot = JSON.parse(await (await import('fs/promises')).readFile(new URL('../data/nirf.data.json', import.meta.url), 'utf8'));
  for (const key of Object.keys(snapshot.dcs || {})) existingKeys.add(key);
  var snapshotIds = new Set(Object.values(snapshot.dcs || {}).map((v) => v.nirfId));
} catch (e) {
  var snapshotIds = new Set();
}

const newCampuses = plan.filter(
  (r) => !existingKeys.has(`${foldName(r.name)}|${foldName(r.state)}`) && !snapshotIds.has(r.nirfId)
);
console.log('2024 plan campuses not covered by 2025 snapshot:', newCampuses.length);
console.log(newCampuses.slice(0, 25).map((r) => `${r.nirfId} r${r.rank} ${r.category} ${r.name}`).join('\n'));
