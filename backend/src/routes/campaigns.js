import express from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  rerunCampaign,
} from '../controllers/CampaignController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, createCampaign);
router.get('/', protect, getCampaigns);
router.get('/:id', protect, getCampaignById);
router.post('/:id/start', protect, startCampaign);
router.post('/:id/pause', protect, pauseCampaign);
router.post('/:id/resume', protect, resumeCampaign);
router.post('/:id/rerun', protect, rerunCampaign);
router.delete('/:id', protect, deleteCampaign);

export default router;
