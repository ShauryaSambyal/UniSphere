import express from 'express';
import { generateAllEmbeddings } from '../controllers/embeddingController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/generate', authenticateToken, requireAdmin, generateAllEmbeddings);

export default router;
