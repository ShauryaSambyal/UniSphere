import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  averagePackage: { type: String },
  medianPackage: { type: String },
  highestPackage: { type: String },
  placementPercentage: { type: String },
  year: { type: Number },
  topRecruiters: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const Placement = mongoose.model('Placement', placementSchema);
export default Placement;
