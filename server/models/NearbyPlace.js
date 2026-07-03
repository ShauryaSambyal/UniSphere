import mongoose from 'mongoose';

const nearbyPlaceSchema = new mongoose.Schema({
  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  name: { type: String, required: true },
  address: { type: String },
  type: { type: String }, // e.g. restaurant, mall, hospital, metro_station
  rating: { type: Number },
  distance: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const NearbyPlace = mongoose.model('NearbyPlace', nearbyPlaceSchema);
export default NearbyPlace;
