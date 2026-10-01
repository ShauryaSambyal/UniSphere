import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema({
  aicteId: { type: String, unique: true, sparse: true, index: true },
  permanentId: { type: String, unique: true, sparse: true, index: true },

  // Provenance for records imported from an open dataset. sourceKey is the
  // stable upsert key (e.g. "ugc:university-of-hyderabad") so a refresh updates
  // the same document instead of duplicating it.
  sourceKey: { type: String, unique: true, sparse: true, index: true },
  source: {
    id: { type: String },
    label: { type: String },
    url: { type: String },
    license: { type: String }
  },
  syncedAt: { type: Date },

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

  // Kept in sync with ranking.nirf. The whole app (sorting, cards, the admin
  // form) reads this field, so it has to exist in the schema or Mongoose
  // silently strips it on save.
  nirfRanking: { type: Number, index: true },

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

  // Extra facts that the open datasets do provide.
  website: { type: String },
  foundedYear: { type: Number },
  studentCount: { type: Number },
  
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
