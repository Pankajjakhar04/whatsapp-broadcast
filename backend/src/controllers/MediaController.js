import fs from 'fs';
import path from 'path';
import { campaignUploadsDir, resolveMediaPath } from '../config/paths.js';

/**
 * Handle Media Upload
 */
export const uploadMedia = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file rejected' });
    }

    // Generate relative url path
    const mediaUrl = `uploads/campaigns/${req.file.filename}`;
    const mediaType = req.file.mimetype;

    res.json({
      success: true,
      mediaUrl,
      mediaType,
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.error('Media Upload Error:', error);
    res.status(500).json({ message: 'Server error during media upload' });
  }
};

/**
 * Delete Media file
 */
export const deleteMedia = (req, res) => {
  try {
    const { mediaUrl } = req.body;
    
    if (!mediaUrl) {
      return res.status(400).json({ message: 'mediaUrl is required' });
    }

    // Prevent directory traversal attacks by resolving and verifying path
    const absolutePath = resolveMediaPath(mediaUrl);
    const uploadsDir = path.resolve(campaignUploadsDir);

    if (!absolutePath.startsWith(uploadsDir)) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      res.json({ success: true, message: 'Media deleted successfully' });
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    console.error('Media Delete Error:', error);
    res.status(500).json({ message: 'Failed to delete media file' });
  }
};
