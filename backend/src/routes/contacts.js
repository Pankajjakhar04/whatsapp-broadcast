import express from 'express';
import { uploadContacts, getTemplate } from '../controllers/ContactController.js';
import { protect } from '../middleware/auth.js';
import { uploadMemory } from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', protect, uploadMemory.single('file'), uploadContacts);
router.get('/template', protect, getTemplate);

export default router;
