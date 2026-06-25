import express from 'express';
import { connect, disconnect, getStatus, updateBio, postStory } from '../controllers/WhatsAppController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/connect', protect, connect);
router.post('/disconnect', protect, disconnect);
router.get('/status', protect, getStatus);
router.post('/bio', protect, updateBio);
router.post('/story', protect, postStory);

export default router;
