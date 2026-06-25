import express from 'express';
import { downloadReport } from '../controllers/ReportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:campaignId', protect, downloadReport);

export default router;
