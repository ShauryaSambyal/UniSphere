import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, foldName, expandAcronyms, nameSimilarity } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const index = buildNirfIndex(snapshot);

const college = await College.findOne({ name: /^Indian Institute of Business Management/i }).lean();
console.log('college:', college.name, JSON.stringify(college.location));

const folded = foldName(college.name);
const nameVariants = [...new Set([folded, expandAcronyms(folded)])];
const seen = new Set();
const extended = [];
const collect = (records) => {
  for (const record of records || []) {
    if (seen.has(record)) continue;
    seen.add(record);
    extended.push(record);
  }
};
for (const name of nameVariants) {
  collect(index.byName.get(name));
  collect(index.byFirstToken?.get(name.split(' ')[0]));
}
console.log('candidates collected:', extended.length);

const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const ck = (v) => String(v || '').split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const ca = (a, b) => {
  const l = ck(a), r = ck(b);
  if (!l || !r) return false;
  if (l === r) return true;
  const [s, lo] = [l, r].sort((x, y) => x.length - y.length);
  return s.length >= 5 && lo.includes(s);
};
const sa = (a, b) => {
  const l = norm(a), r = norm(b);
  if (!l || !r) return false;
  return l === r || l.includes(r) || r.includes(l);
};

const scored = [];
for (const record of extended) {
  const recordName = foldName(record.name);
  if (!recordName) continue;
  const city = ca(college.location?.city, record.city);
  const state = sa(college.location?.state, record.state);
  const hasLocation = Boolean(ck(college.location?.city) || norm(college.location?.state));
  let nameScore = 0;
  let exact = false;
  for (const variant of nameVariants) {
    if (!variant) continue;
    if (variant === recordName) { nameScore = Math.max(nameScore, 4); exact = true; continue; }
    const prefix = (variant.startsWith(recordName) || recordName.startsWith(variant)) &&
      Math.abs(variant.length - recordName.length) <= 20;
    if (prefix && (city || state)) { nameScore = Math.max(nameScore, 2); continue; }
    if (hasLocation && nameSimilarity(variant, recordName) >= 0.7) nameScore = Math.max(nameScore, 2);
  }
  if (nameScore === 0) continue;
  if (hasLocation && !city && !state) continue;
  if (!hasLocation && !exact) continue;
  scored.push({ record, score: nameScore + (city ? 4 : 0) + (state ? 2 : 0), nameScore, city, state, exact });
}

console.log('scored:', scored.length);
for (const s of scored.slice(0, 12)) {
  console.log(`  score=${s.score} nameScore=${s.nameScore} city=${s.city} state=${s.state} exact=${s.exact} :: ${s.record.name} (${s.record.city}, ${s.record.state})`);
}

await mongoose.disconnect();
