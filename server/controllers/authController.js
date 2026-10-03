import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import '../config/env.js';
import { verifyFirebaseIdToken } from '../services/firebaseTokenService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'unisphere-ae503';

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

const adminEmails = () =>
  new Set(
    String(process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const userRole = role === 'admin' ? 'admin' : 'student';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
}

export async function firebaseAuth(req, res) {
  try {
    const { idToken, name, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    const payload = await verifyFirebaseIdToken(idToken, FIREBASE_PROJECT_ID);
    const email = String(payload.email || '').toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Firebase account has no email address' });
    }

    const firebaseUid = payload.user_id || payload.sub;
    const isAllowListedAdmin = adminEmails().has(email);
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || payload.name || email.split('@')[0],
        email,
        firebaseUid,
        role: isAllowListedAdmin || role === 'admin' ? 'admin' : 'student'
      });
    } else {
      let dirty = false;

      if (!user.firebaseUid) {
        user.firebaseUid = firebaseUid;
        dirty = true;
      }

      if (isAllowListedAdmin && user.role !== 'admin') {
        user.role = 'admin';
        dirty = true;
      }

      if (dirty) await user.save();
    }

    const token = generateToken(user._id);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Firebase auth error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired Firebase token' });
  }
}

export async function getMe(req, res) {
  try {
    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}
