import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, foldName, expandAcronyms } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

const iitCount = await College.countDocuments({ name: /indian institute of technology/i });
const nitCount = await College.countDocuments({ name: /national institute of technology/i });
const iitSample = await College.find({ name: /indian institute of technology/i }).select('name location.city location.state').limit(5).lean();
console.log(JSON.stringify({ iitCount, nitCount, iitSample }, null, 2));

const all = await College.find({}).select('name location.city location.state placements').lean();
const byFold = new Map();
for (const c of all) {
  const f = foldName(c.name);
  if (!byFold.has(f)) byFold.set(f, []);
  byFold.get(f).push(c);
}

const unmatched = [];
for (const key of Object.keys(snapshot.dcs || {})) {
  const [name, state] = key.split('|');
  const variants = [name, expandAcronyms(name)];
  let hit = false;
  for (const v of variants) {
    if (byFold.has(v)) { hit = true; break; }
    for (const candidate of byFold.keys()) {
      if (candidate.startsWith(v) && Math.abs(candidate.length - v.length) <= 20) { hit = true; break; }
      if (v.startsWith(candidate) && Math.abs(candidate.length - v.length) <= 20) { hit = true; break; }
    }
    if (hit) break;
  }
  if (!hit) unmatched.push(key);
}

console.log('dossiers with NO loose name match:', unmatched.length, '/', Object.keys(snapshot.dcs || {}).length);
console.log(unmatched.slice(0, 40).join('\n'));

await mongoose.disconnect();
