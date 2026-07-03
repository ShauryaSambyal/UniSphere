import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema({
  aicteId: { type: String, unique: true, sparse: true, index: true },
  permanentId: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  shortName: { type: String, trim: true },
  instituteType: { type: String }, // e.g., Private, Government, Autonomous
  womenOnly: { type: Boolean, default: false },
  hostelAvailable: { type: Boolean, default: false },
  
  location: {
    address: { type: String },
    district: { type: String },
    city: { type: String, index: true },
    state: { type: String, index: true },
    latitude: { type: Number },
    longitude: { type: Number }
  },

  ranking: {
    nirf: { type: Number },
    stateRank: { type: Number }
  },

  placements: {
    averagePackage: { type: String },
    medianPackage: { type: String },
    highestPackage: { type: String },
    placementPercentage: { type: String }
  },

  fees: {
    tuitionFee: { type: String },
    hostelFee: { type: String },
    totalFee: { type: String },
    tuition: { type: String },
    hostel: { type: String }
  },

  hostel: {
    boysHostel: { type: Boolean, default: false },
    girlsHostel: { type: Boolean, default: false },
    details: { type: String }
  },

  courses: [{ type: String }],
  facilities: [{ type: String }],
  
  nearbyPlaces: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NearbyPlace'
  }],
  
  aiSummary: { type: String },
  
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],

  createdAt: { type: Date, default: Date.now }
});

// Compound index for geolocation search
collegeSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
collegeSchema.index({ name: 'text', shortName: 'text' }); // Added text index for fuzzy search

const College = mongoose.model('College', collegeSchema);
export default College;
