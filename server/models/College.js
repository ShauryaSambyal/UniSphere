import mongoose from 'mongoose';

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
    placementRate: { type: Number },
    medianSalary: { type: Number },
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
  instituteType: { type: String },
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

    nirf: { type: nirfPlacementsSchema, default: undefined }
  },

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

  courses: [{ type: String }],

  programmes: [{ type: String }],
  facilities: [{ type: String }],

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

collegeSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
collegeSchema.index({ name: 'text', shortName: 'text' });

const College = mongoose.model('College', collegeSchema);
export default College;
