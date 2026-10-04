import '../config/env.js';
import mongoose from 'mongoose';

console.log('uri set:', Boolean(process.env.MONGODB_URI), (process.env.MONGODB_URI || '').replace(/\/\/[^@]+@/, '//***@'));

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000, bufferTimeoutMS: 60000 });
  console.log('readyState:', mongoose.connection.readyState);
  const College = mongoose.model('College', new mongoose.Schema({}, { strict: false, collection: 'colleges' }));
  const total = await College.countDocuments({});
  const withNirfPl = await College.countDocuments({ 'placements.nirf': { $exists: true } });
  const withAnyString = await College.countDocuments({
    $or: [
      { 'placements.averagePackage': { $nin: [null, ''] } },
      { 'placements.medianPackage': { $nin: [null, ''] } },
      { 'placements.highestPackage': { $nin: [null, ''] } },
      { 'placements.placementPercentage': { $nin: [null, ''] } }
    ]
  });
  const sample = await College.findOne({ 'placements.nirf': { $exists: true } })
    .select('name placements nirfRanking')
    .lean();
  console.log(JSON.stringify({ total, withNirfPl, withAnyString, sampleName: sample?.name, samplePlacements: sample?.placements }, null, 2).slice(0, 2500));
} catch (error) {
  console.error('ERR', error.message);
} finally {
  await mongoose.disconnect().catch(() => {});
}
