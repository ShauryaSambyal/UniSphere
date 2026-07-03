import express from 'express';
import {
  getAllColleges,
  searchAutocomplete,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege,
  triggerAiSummary,
  importColleges,
  getRecommendations,
  getDashboardStats
} from '../controllers/collegeController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAllColleges);
router.get('/search', searchAutocomplete);
router.get('/stats', getDashboardStats);
router.get('/:id', getCollegeById);

// Admin-only endpoints
router.post('/', authenticateToken, requireAdmin, createCollege);
router.put('/:id', authenticateToken, requireAdmin, updateCollege);
router.delete('/:id', authenticateToken, requireAdmin, deleteCollege);
router.post('/:id/summary', authenticateToken, requireAdmin, triggerAiSummary);

// Bulk Import & Recommendations
router.post('/import', importColleges);
router.post('/recommendations', getRecommendations);

export default router;
