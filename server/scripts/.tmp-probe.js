import '../config/env.js';
import mongoose from 'mongoose';
import College from '../models/College.js';

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
const q = async (re) => (await College.find({ name: re }).select('name location.city location.state placements.nirf').limit(8).lean()).map((c) => ({ n: c.name, city: c.location?.city, st: c.location?.state, nirf: Boolean(c.placements?.nirf) }));

console.log('IIIT:', JSON.stringify(await q(/international institute of information technology/i)));
console.log('IIIT short:', JSON.stringify(await q(/^iiit/i)));
console.log('BITS:', JSON.stringify(await q(/birla institute/i)));
console.log('Miranda:', JSON.stringify(await q(/miranda/i)));
console.log('ISM:', JSON.stringify(await q(/school of mines|dhanbad/i)));
console.log('BHU:', JSON.stringify(await q(/banaras|bhu/i)));
console.log('NITK:', JSON.stringify(await q(/national institute of technology.*karnataka|karnataka.*national institute/i)));
console.log('KIIT:', JSON.stringify(await q(/kalinga/i)));
console.log('SSN:', JSON.stringify(await q(/sivasubramaniya|sri sivasi/i)));
console.log('MNIT:', JSON.stringify(await q(/malaviya/i)));
console.log('UPES:', JSON.stringify(await q(/^upes|university of petroleum/i)));
console.log('Symbiosis:', JSON.stringify(await q(/symbiosis/i)));
console.log('Lucknow Univ:', JSON.stringify(await q(/university of lucknow/i)));
console.log('St Stephens:', JSON.stringify(await q(/stephen/i)));
console.log('IIT Madras:', JSON.stringify(await q(/iit madras|indian institute of technology madras/i)));
await mongoose.disconnect();
