import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { campaignUploadsDir } from '../config/paths.js';

// Ensure upload directories exist
if (!fs.existsSync(campaignUploadsDir)) {
  fs.mkdirSync(campaignUploadsDir, { recursive: true });
}

// Memory Storage (for quick reading without cluttering disk, e.g. Excel sheets)
const memoryStorage = multer.memoryStorage();
export const uploadMemory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Disk Storage (for persistent media assets, e.g. campaign images)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, campaignUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `campaign-${uniqueSuffix}${ext}`);
  },
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.'), false);
  }
};

export const uploadDisk = multer({
  storage: diskStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});
