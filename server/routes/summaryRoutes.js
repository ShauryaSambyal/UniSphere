import express from 'express';
import { triggerAiSummary } from '../controllers/collegeController.js';

const router = express.Router();

router.post('/:id', triggerAiSummary);

export default router;
