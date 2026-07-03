import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  name: { type: String, required: true },
  level: { type: String }, // e.g. "UG", "PG", "Diploma"
  duration: { type: String }, // e.g. "4 Years"
  intake: { type: Number },
  category: { type: String }, // e.g. "Engineering", "Management"
  createdAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);
export default Course;
