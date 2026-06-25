import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Config & Database
import connectDB from './config/db.js';
import { uploadsRoot } from './config/paths.js';
import { initSocket } from './services/SocketService.js';

// Routes
import authRoutes from './routes/auth.js';
import whatsappRoutes from './routes/whatsapp.js';
import contactsRoutes from './routes/contacts.js';
import campaignRoutes from './routes/campaigns.js';
import mediaRoutes from './routes/media.js';
import reportRoutes from './routes/reports.js';

// Initialize dotenv
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to MongoDB
await connectDB();

// Auto-initialize active WhatsApp sessions on server start
try {
  const { initializeAllSessions } = await import('./services/WhatsAppService.js');
  await initializeAllSessions();
} catch (err) {
  console.error('Failed to pre-boot active WhatsApp sessions on start:', err.message);
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
};

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Uploads
app.use('/uploads', express.static(uploadsRoot));

// Routes mapping
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
