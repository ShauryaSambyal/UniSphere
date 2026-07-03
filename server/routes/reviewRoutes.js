import express from 'express';
import { addReview, upvoteReview } from '../controllers/reviewController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authenticateToken, addReview);
router.post('/:reviewId/upvote', authenticateToken, upvoteReview);

export default router;
