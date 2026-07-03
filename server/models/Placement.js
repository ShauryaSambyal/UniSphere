import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  averagePackage: { type: String }, // e.g. "12.5 LPA"
  medianPackage: { type: String },
  highestPackage: { type: String }, // e.g. "45.0 LPA"
  placementPercentage: { type: String }, // e.g. "95%"
  year: { type: Number },
  topRecruiters: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const Placement = mongoose.model('Placement', placementSchema);
export default Placement;
