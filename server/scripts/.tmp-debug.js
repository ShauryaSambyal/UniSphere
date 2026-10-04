import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';
import { readNirfSnapshot, buildNirfIndex, matchCollegeToNirf, foldName, expandAcronyms, nameSimilarity } from '../services/nirfService.js';

const snapshot = await readNirfSnapshot();
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const index = buildNirfIndex(snapshot);

for (const name of ['Indian Institute of Business Management', 'JSS Academy of Higher Education & Research']) {
  const college = await College.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') }).lean();
  if (!college) { console.log('not found:', name); continue; }
  const campus = matchCollegeToNirf(college, index);
  console.log('\nCOLLEGE:', college.name, '|', college.location?.city, ',', college.location?.state);
  if (!campus) { console.log('  no match'); continue; }
  for (const record of campus.records.slice(0, 6)) {
    const a = expandAcronyms(foldName(college.name));
    const b = foldName(record.name);
    console.log(`  score-record: ${record.name} (${record.city}, ${record.state}) sim=${nameSimilarity(a, b).toFixed(3)} expandedSim=${nameSimilarity(expandAcronyms(b), b).toFixed(3)}`);
  }
  console.log('  dcs:', campus.dcs ? campus.dcs.nirfId : null);
}

await mongoose.disconnect();
