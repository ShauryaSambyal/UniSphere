import express from 'express';
import { askAssistant } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', askAssistant);

export default router;
