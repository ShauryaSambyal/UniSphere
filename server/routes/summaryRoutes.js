import express from 'express';
import { triggerAiSummary } from '../controllers/collegeController.js';
// Optionally protect with auth: import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/generate-summary/:id
 * Called by CollegeDetails.jsx to generate an AI summary for a college.
 * Delegates to the same triggerAiSummary controller used by the admin route.
 */
router.post('/:id', triggerAiSummary);

export default router;
