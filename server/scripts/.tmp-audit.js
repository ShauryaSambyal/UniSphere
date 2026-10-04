import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, matchCollegeToNirf, computeNirfFields, foldName, expandAcronyms, nameSimilarity } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const colleges = await College.find({}).lean();
const index = buildNirfIndex(snapshot);

const cityKey = (v) => String(v || '').split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const stateKey = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const rows = [];
for (const college of colleges) {
  if (college.placements?.nirf) continue;
  const campus = matchCollegeToNirf(college, index);
  if (!campus?.dcs) continue;
  const fields = computeNirfFields(college, campus, snapshot);
  if (!fields.placementsNirf) continue;

  const winner = campus.records[0];
  const folded = foldName(college.name);
  const variants = [folded, expandAcronyms(folded)];
  const recFolded = foldName(winner.name);
  let how = 'fuzzy';
  if (variants.includes(recFolded)) how = 'exact';
  else if (variants.some((v) => (v.startsWith(recFolded) || recFolded.startsWith(v)) && Math.abs(v.length - recFolded.length) <= 20)) how = 'prefix';
  else if (variants.some((v) => nameSimilarity(v, recFolded) >= 0.7)) how = 'similar';

  const locAgree =
    (cityKey(college.location?.city) && cityKey(college.location?.city) === cityKey(winner.city)) ||
    (stateKey(college.location?.state) && stateKey(college.location?.state) === stateKey(winner.state)) ||
    (!cityKey(college.location?.city) && !stateKey(college.location?.state) ? 'NO-LOC' : false);

  rows.push({
    how,
    loc: locAgree === 'NO-LOC' ? 'NO-LOC' : locAgree ? 'ok' : 'CHECK',
    college: college.name,
    city: college.location?.city || '-',
    st: college.location?.state || '-',
    winner: winner.name,
    wcity: winner.city || '-',
    wst: winner.state || '-'
  });
}

const byHow = rows.reduce((acc, r) => { acc[r.how] = (acc[r.how] || 0) + 1; return acc; }, {});
const byLoc = rows.reduce((acc, r) => { acc[r.loc] = (acc[r.loc] || 0) + 1; return acc; }, {});
console.log(JSON.stringify({ total: rows.length, byHow, byLoc }, null, 2));

console.log('\n-- CHECK location disagreements --');
for (const r of rows.filter((r) => r.loc === 'CHECK').slice(0, 40)) {
  console.log(`[${r.how}] ${r.college} (${r.city}, ${r.st}) => ${r.winner} (${r.wcity}, ${r.wst})`);
}

console.log('\n-- fuzzy/similar matches (sample) --');
for (const r of rows.filter((r) => r.how === 'fuzzy' || r.how === 'similar').slice(0, 40)) {
  console.log(`[${r.loc}] ${r.college} (${r.city}, ${r.st}) => ${r.winner} (${r.wcity}, ${r.wst})`);
}

await mongoose.disconnect();
