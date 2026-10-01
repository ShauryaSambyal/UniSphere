import mongoose from 'mongoose';

// Sub-schemas for NIRF data (MoE rankings + Data Submitted by Institution
// dossiers). Kept explicit so Mongoose persists every field the sync writes.
const nirfRankSchema = new mongoose.Schema(
  {
    category: { type: String },
    rank: { type: Number },
    score: { type: Number }
  },
  { _id: false }
);

const nirfBandSchema = new mongoose.Schema(
  {
    category: { type: String },
    band: { type: String }
  },
  { _id: false }
);

const placementRowSchema = new mongoose.Schema(
  {
    intakeYear: { type: String },
    intake: { type: Number },
    admitted: { type: Number },
    lateral: { type: Number },
    graduatingYear: { type: String },
    graduating: { type: Number },
    placed: { type: Number },
    medianSalary: { type: Number },
    higherStudies: { type: Number }
  },
  { _id: false }
);

const placementLevelSchema = new mongoose.Schema(
  {
    level: { type: String },
    latest: { type: placementRowSchema }
  },
  { _id: false }
);

const nirfPlacementsSchema = new mongoose.Schema(
  {
    year: { type: Number },
    placed: { type: Number },
    graduates: { type: Number },
    placementRate: { type: Number }, // percent, one decimal
    medianSalary: { type: Number }, // rupees per annum (primary programme)
    higherStudies: { type: Number },
    students: { type: Number },
    primaryLevel: { type: String },
    sourceUrl: { type: String },
    levels: { type: [placementLevelSchema], default: undefined }
  },
  { _id: false }
);

const strengthLevelSchema = new mongoose.Schema(
  {
    level: { type: String },
    male: { type: Number },
    female: { type: Number },
    total: { type: Number },
    withinState: { type: Number },
    outsideState: { type: Number },
    outsideCountry: { type: Number },
    economicallyBackward: { type: Number },
    sociallyChallenged: { type: Number },
    pcsStudents: { type: Number },
    feeReimbursementState: { type: Number },
    feeReimbursementInstitution: { type: Number },
    feeReimbursementPrivate: { type: Number }
  },
  { _id: false }
);

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
    placementPercentage: { type: String },

    // Real figures from the NIRF "Data Submitted by Institution" dossier:
    // graduates, placed, median salary of placed graduates and higher studies,
    // per programme level, latest reported academic year.
    nirf: { type: nirfPlacementsSchema, default: undefined }
  },

  // NIRF ranking appearances (exact ranks) plus rank-band membership
  // (101-150, 151-200, 201-300) the directory can display honestly.
  nirf: {
    year: { type: Number },
    ranks: { type: [nirfRankSchema], default: undefined },
    bands: { type: [nirfBandSchema], default: undefined },
    bestRank: { type: Number },
    bestCategory: { type: String },
    sourceUrl: { type: String }
  },

  studentStrength: {
    total: { type: Number },
    male: { type: Number },
    female: { type: Number },
    levels: { type: [strengthLevelSchema], default: undefined }
  },

  facultyCount: { type: Number },

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

  // Broad streams ("Engineering and Technology", "Management") — what the
  // course filters and the match maker operate on.
  courses: [{ type: String }],
  // Detailed specialisations ("Computer Science and Engineering") shown on the
  // college page and used for fine-grained course matching.
  programmes: [{ type: String }],
  facilities: [{ type: String }],

  // Extra facts that the open datasets do provide.
  website: { type: String },
  foundedYear: { type: Number },
  studentCount: { type: Number },
  affiliatedTo: { type: String },
  
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
