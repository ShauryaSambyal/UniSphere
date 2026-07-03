import mongoose from 'mongoose';

const hostelSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  boysHostel: { type: Boolean, default: false },
  girlsHostel: { type: Boolean, default: false },
  details: { type: String },
  capacity: { type: Number },
  fees: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Hostel = mongoose.model('Hostel', hostelSchema);
export default Hostel;
