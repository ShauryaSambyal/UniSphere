import mongoose from 'mongoose';

const vectorDocumentSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number], // Array of floats
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: { type: Date, default: Date.now }
});

const VectorDocument = mongoose.model('VectorDocument', vectorDocumentSchema);
export default VectorDocument;
