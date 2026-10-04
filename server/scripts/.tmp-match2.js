import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, matchCollegeToNirf, computeNirfFields } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const colleges = await College.find({}).lean();
const index = buildNirfIndex(snapshot);

let matched = 0;
let withDcs = 0;
let wouldAddPlacements = 0;
let newerPlacements = 0;
const newlyPlaced = [];

for (const college of colleges) {
  const campus = matchCollegeToNirf(college, index);
  if (!campus) continue;
  matched += 1;
  if (!campus.dcs) continue;
  withDcs += 1;
  const fields = computeNirfFields(college, campus, snapshot);
  if (!fields.placementsNirf) continue;
  const existing = college.placements?.nirf;
  if (!existing) {
    wouldAddPlacements += 1;
    if (newlyPlaced.length < 25) newlyPlaced.push(college.name);
  } else if ((Number(fields.placementsNirf.year) || 0) > (Number(existing.year) || 0)) {
    newerPlacements += 1;
  }
}

const totalPlaced = await College.countDocuments({ 'placements.nirf': { $exists: true } });
console.log(JSON.stringify({
  totalColleges: colleges.length,
  matched,
  matchedWithDossier: withDcs,
  wouldAddPlacements,
  newerPlacements,
  alreadyPlaced: totalPlaced,
  projectedPlaced: totalPlaced + wouldAddPlacements
}, null, 2));
console.log('\nSample of newly placed:\n' + newlyPlaced.join('\n'));

await mongoose.disconnect();
