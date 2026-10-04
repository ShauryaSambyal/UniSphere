import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, foldName, expandAcronyms, nameSimilarity } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

const normalizeName = (name) =>
  String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const CITY_ALIASES = { bangalore: 'bengaluru', mysore: 'mysuru' };
const cityKey = (value) => {
  const first = String(value || '').split(',')[0].trim().toLowerCase();
  const clean = first.replace(/[^a-z0-9]+/g, '');
  return CITY_ALIASES[clean] || clean;
};
const cityAgrees = (a, b) => {
  const left = cityKey(a);
  const right = cityKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const [short, long] = [left, right].sort((x, y) => x.length - y.length);
  return short.length >= 5 && long.includes(short);
};
const stateAgrees = (a, b) => {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const college = await College.findOne({ name: /^Indian Institute of Business Management/i }).lean();
const folded = foldName(college.name);
const variants = [...new Set([folded, expandAcronyms(folded)])];
console.log('college:', JSON.stringify(college.location), 'variants:', variants);

const matches = snapshot.institutes.filter(
  (r) => foldName(r.name).startsWith('indian institute of manage') || foldName(r.name).startsWith('indian institute of business')
);
for (const record of matches.slice(0, 8)) {
  const recordName = foldName(record.name);
  const city = cityAgrees(college.location?.city, record.city);
  const state = stateAgrees(college.location?.state, record.state);
  let nameScore = 0;
  for (const variant of variants) {
    if (variant === recordName) nameScore = Math.max(nameScore, 4);
    else if (
      (variant.startsWith(recordName) || recordName.startsWith(variant)) &&
      Math.abs(variant.length - recordName.length) <= 20 &&
      (city || state)
    ) nameScore = Math.max(nameScore, 2);
    else if (nameSimilarity(variant, recordName) >= 0.7) nameScore = Math.max(nameScore, 2);
  }
  console.log(
    `record=${JSON.stringify(record.name)} city=${JSON.stringify(record.city)} state=${JSON.stringify(record.state)} rank=${record.rank} cat=${record.category} | city=${city} state=${state} nameScore=${nameScore} sim=${nameSimilarity(variants[0], recordName).toFixed(3)}`
  );
}

await mongoose.disconnect();
