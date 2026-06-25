import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import WhatsAppSession from '../models/WhatsAppSession.js';
import { waAuthDir } from '../config/paths.js';
import { emitToUser } from './SocketService.js';

const { Client, LocalAuth, MessageMedia } = pkg;

if (!fs.existsSync(waAuthDir)) {
  fs.mkdirSync(waAuthDir, { recursive: true });
}

// Active whatsapp client instances: userId -> Client
const activeClients = new Map();

/**
 * Get or create WhatsApp client for a user
 */
export const getWhatsAppClient = (userId) => {
  return activeClients.get(userId.toString());
};

/**
 * Initialize WhatsApp connection for a user
 */
export const initWhatsAppClient = async (userId) => {
  const userIdStr = userId.toString();

  // If client already exists and is initialized, return it
  if (activeClients.has(userIdStr)) {
    const existing = activeClients.get(userIdStr);
    return existing;
  }

  // Create session record in DB if it doesn't exist
  let session = await WhatsAppSession.findOne({ userId });
  if (!session) {
    session = new WhatsAppSession({
      userId,
      sessionId: `session-${userIdStr}`,
      status: 'Disconnected',
    });
    await session.save();
  }

  // Update status to Connecting
  await WhatsAppSession.updateOne(
    { userId },
    { status: 'Connecting', qrCode: '' }
  );
  emitToUser(userIdStr, 'whatsapp-status', { status: 'Connecting', qrCode: '' });

  // Setup Puppeteer options
  const headless = process.env.PUPPETEER_HEADLESS === 'true';
  const puppeteerArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];
  const puppeteerOptions = {
    headless,
    args: puppeteerArgs,
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Setup client
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: `session-${userIdStr}`,
      dataPath: waAuthDir,
    }),
    puppeteer: puppeteerOptions,
  });

  // Event handlers
  client.on('qr', async (qr) => {
    try {
      // Generate QR base64 image URL
      const qrImageUrl = await QRCode.toDataURL(qr);
      
      // Save QR code to database
      await WhatsAppSession.updateOne(
        { userId },
        { status: 'Connecting', qrCode: qrImageUrl }
      );

      console.log(`QR generated for user ${userIdStr}`);
      emitToUser(userIdStr, 'whatsapp-status', { status: 'Connecting', qrCode: qrImageUrl });
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  });

  client.on('ready', async () => {
    await WhatsAppSession.updateOne(
      { userId },
      { status: 'Connected', qrCode: '', connectedAt: new Date() }
    );

    console.log(`WhatsApp client ready for user ${userIdStr}`);
    emitToUser(userIdStr, 'whatsapp-status', { status: 'Connected', qrCode: '' });
  });

  client.on('authenticated', () => {
    console.log(`WhatsApp authenticated for user ${userIdStr}`);
  });

  client.on('auth_failure', async (msg) => {
    console.error(`Auth failure for user ${userIdStr}:`, msg);
    await WhatsAppSession.updateOne(
      { userId },
      { status: 'Session Expired', qrCode: '' }
    );
    emitToUser(userIdStr, 'whatsapp-status', { status: 'Session Expired', qrCode: '' });
    activeClients.delete(userIdStr);
  });

  client.on('disconnected', async (reason) => {
    console.log(`WhatsApp disconnected for user ${userIdStr}:`, reason);
    await WhatsAppSession.updateOne(
      { userId },
      { status: 'Disconnected', qrCode: '', disconnectedAt: new Date() }
    );

    emitToUser(userIdStr, 'whatsapp-status', { status: 'Disconnected', qrCode: '' });
    activeClients.delete(userIdStr);
    
    try {
      await client.destroy();
    } catch (e) {
      // ignore client already destroyed
    }
  });

  // Store in activeClients map
  activeClients.set(userIdStr, client);

  // Start initialization in background
  client.initialize().catch(async (err) => {
    console.error(`Initialization error for user ${userIdStr}:`, err);
    await WhatsAppSession.updateOne(
      { userId },
      { status: 'Disconnected', qrCode: '' }
    );
    emitToUser(userIdStr, 'whatsapp-status', { status: 'Disconnected', qrCode: '' });
    activeClients.delete(userIdStr);
  });

  return client;
};

/**
 * Disconnect and destroy WhatsApp client session
 */
export const disconnectWhatsApp = async (userId) => {
  const userIdStr = userId.toString();
  const client = activeClients.get(userIdStr);

  await WhatsAppSession.updateOne(
    { userId },
    { status: 'Disconnected', qrCode: '', disconnectedAt: new Date() }
  );

  emitToUser(userIdStr, 'whatsapp-status', { status: 'Disconnected', qrCode: '' });

  if (client) {
    try {
      await client.logout();
      await client.destroy();
    } catch (err) {
      console.error(`Error during client logout/destroy for ${userIdStr}:`, err.message);
    }
    activeClients.delete(userIdStr);
  }

  // Delete authentication files for this session to force re-auth
  const sessionDir = path.join(waAuthDir, `session-session-${userIdStr}`);
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`Session directory cleared: ${sessionDir}`);
    }
  } catch (err) {
    console.error(`Failed to delete session directory ${sessionDir}:`, err.message);
  }
};

/**
 * Helper to check session status in DB
 */
export const getSessionStatus = async (userId) => {
  const session = await WhatsAppSession.findOne({ userId });
  return session ? session.status : 'Disconnected';
};

/**
 * Check if the in-memory client is ready
 */
export const isClientReady = (userId) => {
  const client = activeClients.get(userId.toString());
  return client && client.info && client.info.wid;
};

/**
 * Auto-initialize all active sessions from the database on startup
 */
export const initializeAllSessions = async () => {
  try {
    const activeSessions = await WhatsAppSession.find({ status: 'Connected' });
    console.log(`Auto-initializing ${activeSessions.length} active WhatsApp sessions from database...`);
    for (const session of activeSessions) {
      console.log(`Pre-booting WhatsApp client for user: ${session.userId}`);
      initWhatsAppClient(session.userId).catch((err) => {
        console.error(`Failed to pre-boot session for user ${session.userId}:`, err.message);
      });
    }
  } catch (err) {
    console.error('Error auto-initializing sessions:', err.message);
  }
};

export { MessageMedia };
