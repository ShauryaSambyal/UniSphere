import express from 'express';
import { askAssistant } from '../controllers/chatController.js';

const router = express.Router();

// Public chat routing (or authenticate if desired, let's keep it open for public usability but optionally protectable)
router.post('/', askAssistant);

export default router;
