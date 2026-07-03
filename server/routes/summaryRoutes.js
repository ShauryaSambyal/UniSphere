import express from 'express';
import College from '../models/College.js';
import { generateSummary } from '../services/llamaService.js';
import { syncCollegeToVectorDb } from '../services/chromaService.js';
// import { authenticateToken, requireAdmin } from '../middleware/auth.js'; // optionally protect

const router = express.Router();

router.post('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const college = await College.findById(id);

    if (!college) {
      return res.status(404).json({ message: 'College not found' });
    }

    // Pass college data to Llama
    const summary = await generateSummary(college);
    
    // Store in MongoDB
    college.aiSummary = summary;
    await college.save();

    // Re-sync vectors because the document content changed
    syncCollegeToVectorDb(college).catch(console.error);

    return res.json({ message: 'Summary generated successfully', summary });
  } catch (error) {
    console.error('Error in generate summary route:', error);
    return res.status(500).json({ message: 'AI Summary generation failed', error: error.message });
  }
});

export default router;
