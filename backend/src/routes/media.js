import express from 'express';
import { uploadMedia, deleteMedia } from '../controllers/MediaController.js';
import { protect } from '../middleware/auth.js';
import { uploadDisk } from '../middleware/upload.js';

const router = express.Router();

router.post('/upload', protect, uploadDisk.single('image'), uploadMedia);
router.post('/delete', protect, deleteMedia);
router.delete('/', protect, deleteMedia); // Support both methods

export default router;
