import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    // Optional: accounts created through Firebase never set a local password.
    required: false
  },
  firebaseUid: {
    type: String,
    index: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to hash the password when it changes. Mongoose 9 does not pass
// a `next` callback to async middleware, so this returns normally and lets
// rejected promises propagate as validation errors.
userSchema.pre('save', async function () {
  // Firebase-only accounts never have a local password to hash.
  if (!this.isModified('password') || !this.password) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // Firebase-only accounts have no local password
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
