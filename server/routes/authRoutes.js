import express from 'express';
import { register, login, firebaseAuth, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/firebase', firebaseAuth);   // exchanges a Firebase ID token for a JWT
router.get('/me', authenticateToken, getMe);

export default router;
