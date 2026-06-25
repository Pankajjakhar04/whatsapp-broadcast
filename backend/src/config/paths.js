import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendRoot = path.resolve(__dirname, '../..');

export const uploadsRoot = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(backendRoot, 'uploads');

export const campaignUploadsDir = path.join(uploadsRoot, 'campaigns');

export const waAuthDir = process.env.WA_AUTH_DIR
  ? path.resolve(process.env.WA_AUTH_DIR)
  : path.join(backendRoot, '.wwebjs_auth');

export const resolveMediaPath = (mediaUrl = '') => {
  const normalized = mediaUrl.replace(/^\/+/, '').replace(/\\/g, '/');

  if (normalized.startsWith('uploads/')) {
    const relativeToUploads = normalized.slice('uploads/'.length);
    return path.resolve(path.join(uploadsRoot, relativeToUploads));
  }

  return path.resolve(path.join(uploadsRoot, normalized));
};
