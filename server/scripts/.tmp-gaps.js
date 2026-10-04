import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, foldName, expandAcronyms } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const all = await College.find({}).select('name location.city location.state placements nirfRanking').lean();

const byFold = new Map();
for (const c of all) {
  const f = foldName(c.name);
  if (!byFold.has(f)) byFold.set(f, []);
  byFold.get(f).push(c);
}
const stopTokens = new Set(['the', 'of', 'and', 'in', 'for', 'college', 'institute', 'university', 'engineering', 'technology', 'school', 'studies', 'education']);
const tokens = (s) => new Set(String(s).split(' ').filter((t) => t.length > 2 && !stopTokens.has(t)));
const jaccard = (a, b) => {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
};

let exactBlockedByLocation = 0;
let fuzzyPossible = 0;
let alreadyMatchedByCurrent = 0;
const fuzzyExamples = [];
const blockedExamples = [];

for (const key of Object.keys(snapshot.dcs || {})) {
  const [name, state] = key.split('|');
  const variants = [name, expandAcronyms(name)];

  let exact = null;
  for (const v of variants) {
    if (byFold.has(v)) { exact = byFold.get(v); break; }
  }

  if (exact && exact.length > 0) {
    const usable = exact.filter((c) => c.location?.city || c.location?.state);
    if (usable.length === 0) {
      exactBlockedByLocation += 1;
      if (blockedExamples.length < 10) blockedExamples.push(`${key} => ${exact.map((c) => c.name).join(' / ')}`);
    } else if (exact.some((c) => c.placements?.nirf)) {
      alreadyMatchedByCurrent += 1;
    } else {
      if (blockedExamples.length < 10) blockedExamples.push(`OK-EXACT-NODCS ${key}`);
    }
    continue;
  }

  const targetTokens = tokens(name);
  let best = null;
  for (const [candidate, cols] of byFold) {
    const score = jaccard(targetTokens, tokens(candidate));
    if (score >= 0.6 && (!best || score > best.score)) best = { candidate, score, cols };
  }
  if (best) {
    fuzzyPossible += 1;
    if (fuzzyExamples.length < 15) fuzzyExamples.push(`${best.score.toFixed(2)} ${key} => ${best.candidate} [${best.cols.map((c) => `${c.location?.city}/${c.location?.state}${c.placements?.nirf ? ' HAS-NIRF' : ''}`).join('; ')}]`);
  }
}

console.log(JSON.stringify({ dcsKeys: Object.keys(snapshot.dcs).length, exactBlockedByLocation, exactAlreadyHasNirfOrOk: alreadyMatchedByCurrent, fuzzyPossible }, null, 2));
console.log('\n-- blocked exact matches (no city AND no state) --');
console.log(blockedExamples.join('\n'));
console.log('\n-- fuzzy candidates (>=0.6 token jaccard) --');
console.log(fuzzyExamples.join('\n'));

await mongoose.disconnect();
