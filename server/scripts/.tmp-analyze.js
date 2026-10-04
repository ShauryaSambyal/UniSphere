import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, matchCollegeToNirf, foldName, expandAcronyms, nameSimilarity, cityAgrees, stateAgrees } from '../services/nirfService.js';

const GENERIC = new Set([
  'institute', 'college', 'university', 'of', 'and', 'the', 'for', 'at', 'deemed', 'autonomous',
  'national', 'india', 'indian', 'government', 'polytechnic', 'school', 'department', 'faculty',
  'campus', 'centre', 'center', 'society', 'trust', 'education', 'research', 'studies', 'study',
  'higher', 'technical', 'science', 'sciences', 'engineering', 'technology', 'arts', 'art'
]);

const tokens = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

const distinctive = (name) => tokens(name).filter((token) => !GENERIC.has(token) && token.length > 1);

const fuzzyTokenMatch = (a, b) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return nameSimilarity(a, b) >= 0.8;
};

const distinctiveJaccard = (left, right) => {
  const a = distinctive(left);
  const b = distinctive(right);
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const usedB = new Set();
  let matched = 0;
  for (const token of a) {
    const hit = b.findIndex((other, i) => !usedB.has(i) && fuzzyTokenMatch(token, other));
    if (hit >= 0) {
      usedB.add(hit);
      matched += 1;
    }
  }
  return matched / (a.length + b.length - matched);
};

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const colleges = await College.find({}).lean();
const index = buildNirfIndex(snapshot);

const rows = [];
for (const college of colleges) {
  const campus = matchCollegeToNirf(college, index);
  if (!campus) continue;
  const winner = campus.records[0];
  const folded = foldName(college.name);
  const variants = [...new Set([folded, expandAcronyms(folded)])];
  const recFolded = foldName(winner.name);
  const fullSim = Math.max(...variants.map((v) => nameSimilarity(v, recFolded)));
  const city = cityAgrees(college.location?.city, winner.city);
  const state = stateAgrees(college.location?.state, winner.state);
  const distJ = Math.max(...variants.map((v) => distinctiveJaccard(v, recFolded)));
  const prefix = variants.some(
    (v) => (v.startsWith(recFolded) || recFolded.startsWith(v)) && Math.abs(v.length - recFolded.length) <= 20
  );
  const exact = variants.includes(recFolded);
  const collegeNameTokens = tokens(college.name);
  const recCityTokens = tokens(winner.city);
  const colCityTokens = tokens(college.location?.city);
  const nameCityLink =
    (recCityTokens.length > 0 && recCityTokens.every((t) => collegeNameTokens.includes(t))) ||
    (colCityTokens.length > 0 && colCityTokens.every((t) => recCityTokens.includes(t)));
  const bothCities = colCityTokens.length > 0 && recCityTokens.length > 0;
  rows.push({
    exact,
    prefix,
    city,
    state,
    fullSim: Number(fullSim.toFixed(3)),
    distJ: Number(distJ.toFixed(3)),
    nameCityLink,
    bothCities,
    hasDcs: Boolean(campus.dcs),
    already: Boolean(college.placements?.nirf),
    c: college.name,
    cc: college.location?.city || '-',
    cs: college.location?.state || '-',
    r: winner.name,
    rc: winner.city || '-',
    rs: winner.state || '-'
  });
}

console.log('total matched:', rows.length, 'with dcs:', rows.filter((r) => r.hasDcs).length);

const weak = rows.filter((r) => !r.exact && !r.prefix);
console.log('fuzzy-only matches:', weak.length);
console.log('');
for (const r of weak.sort((a, b) => a.distJ - b.distJ)) {
  const flags = [
    r.city ? 'city' : '----',
    r.state ? 'stat' : '----',
    r.nameCityLink ? 'link' : '----',
    r.hasDcs ? 'DCS' : '---',
    r.already ? 'OLD' : 'new'
  ].join(' ');
  console.log(
    `sim=${r.fullSim.toFixed(3)} distJ=${r.distJ.toFixed(3)} ${flags} | ${r.c} (${r.cc}, ${r.cs}) => ${r.r} (${r.rc}, ${r.rs})`
  );
}

await mongoose.disconnect();
