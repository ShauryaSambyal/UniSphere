import mongoose from 'mongoose';

const feeSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  courseName: { type: String },
  tuitionFee: { type: String },
  hostelFee: { type: String },
  totalFee: { type: String },
  year: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const Fee = mongoose.model('Fee', feeSchema);
export default Fee;
