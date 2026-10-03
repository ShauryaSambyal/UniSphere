import express from 'express';
import {
  getAllColleges,
  searchAutocomplete,
  getFilterOptions,
  getCollegesByIds,
  getCollegeById,
  createCollege,
  updateCollege,
  deleteCollege,
  triggerAiSummary,
  importColleges,
  getRecommendations,
  getDashboardStats,
  getDatasetInfo,
  refreshDataset
} from '../controllers/collegeController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAllColleges);
router.get('/search', searchAutocomplete);
router.get('/filters', getFilterOptions);
router.get('/batch', getCollegesByIds);
router.get('/stats', getDashboardStats);
router.get('/dataset', getDatasetInfo);
router.get('/:id', getCollegeById);

router.post('/import', importColleges);
router.post('/recommendations', getRecommendations);

router.post('/', authenticateToken, requireAdmin, createCollege);
router.put('/:id', authenticateToken, requireAdmin, updateCollege);
router.delete('/:id', authenticateToken, requireAdmin, deleteCollege);
router.post('/:id/summary', authenticateToken, requireAdmin, triggerAiSummary);
router.post('/refresh', authenticateToken, requireAdmin, refreshDataset);

export default router;
