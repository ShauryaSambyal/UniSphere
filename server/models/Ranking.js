import mongoose from 'mongoose';

const rankingSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  nirf: { type: Number },
  stateRank: { type: Number },
  category: { type: String }, // e.g. "Engineering", "Overall"
  year: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const Ranking = mongoose.model('Ranking', rankingSchema);
export default Ranking;
