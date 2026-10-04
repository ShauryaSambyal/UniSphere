import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, matchCollegeToNirf, foldName } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const colleges = await College.find({}).lean();
const index = buildNirfIndex(snapshot);

let matched = 0;
let withDcs = 0;
let matchedNoDcs = 0;
let alreadyPlaced = 0;
const dcsKeys = new Set(Object.keys(snapshot.dcs || {}));

for (const college of colleges) {
  const campus = matchCollegeToNirf(college, index);
  if (!campus) continue;
  matched += 1;
  const hasDcs = Boolean(campus.dcs);
  if (hasDcs) {
    withDcs += 1;
    if (college.placements?.nirf) alreadyPlaced += 1;
  } else {
    matchedNoDcs += 1;
  }
}

const withPlacementsNow = await College.countDocuments({ 'placements.nirf': { $exists: true } });

console.log(JSON.stringify({
  totalColleges: colleges.length,
  snapshotDcsKeys: dcsKeys.size,
  matched,
  matchedWithDcs: withDcs,
  matchedWithoutDcs: matchedNoDcs,
  alreadyPlacedAmongMatched: alreadyPlaced,
  withPlacementsNow
}, null, 2));

const unmatchedDcsKeys = [];
const matchedKeys = new Set();
for (const college of colleges) {
  const campus = matchCollegeToNirf(college, index);
  if (!campus) continue;
  const rec = campus.records[0];
  matchedKeys.add(`${foldName(rec.name)}|${foldName(rec.state)}`);
}
for (const key of dcsKeys) if (!matchedKeys.has(key)) unmatchedDcsKeys.push(key);
console.log('dossiers with no matching college:', unmatchedDcsKeys.length);
console.log(unmatchedDcsKeys.slice(0, 20).join('\n'));

await mongoose.disconnect();
