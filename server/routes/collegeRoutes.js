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

// ─── Public GET Routes ────────────────────────────────────────────────────────
// IMPORTANT: Static paths (/search, /stats) must come BEFORE the dynamic /:id
// route, otherwise Express will treat "search" and "stats" as an :id value.
router.get('/', getAllColleges);
router.get('/search', searchAutocomplete);           // SearchBar.jsx, Compare.jsx
router.get('/stats', getDashboardStats);             // Admin.jsx
router.get('/:id', getCollegeById);                  // CollegeDetails.jsx

// ─── Public POST Routes ───────────────────────────────────────────────────────
// Static POST paths must also come before dynamic /:id/* routes.
router.post('/import', importColleges);              // (bulk import utility — no frontend UI)
router.post('/recommendations', getRecommendations); // Recommendations.jsx

// ─── Admin-Only Routes ────────────────────────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, createCollege);              // Admin.jsx
router.put('/:id', authenticateToken, requireAdmin, updateCollege);            // Admin.jsx
router.delete('/:id', authenticateToken, requireAdmin, deleteCollege);         // Admin.jsx
router.post('/:id/summary', authenticateToken, requireAdmin, triggerAiSummary); // Admin.jsx

export default router;
