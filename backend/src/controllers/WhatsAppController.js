import { initWhatsAppClient, disconnectWhatsApp, getSessionStatus, getWhatsAppClient, MessageMedia } from '../services/WhatsAppService.js';
import WhatsAppSession from '../models/WhatsAppSession.js';
import fs from 'fs';
import { resolveMediaPath } from '../config/paths.js';

/**
 * Connect WhatsApp (trigger QR generation)
 */
export const connect = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`Initiating connection for user: ${userId}`);
    
    // Initialize the WhatsApp Web Client
    await initWhatsAppClient(userId);
    
    res.json({ message: 'WhatsApp connection process initiated' });
  } catch (error) {
    console.error('WhatsApp Connect Error:', error);
    res.status(500).json({ message: 'Failed to initiate WhatsApp connection' });
  }
};

/**
 * Disconnect WhatsApp
 */
export const disconnect = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`Disconnecting WhatsApp for user: ${userId}`);
    
    await disconnectWhatsApp(userId);
    
    res.json({ message: 'WhatsApp disconnected successfully' });
  } catch (error) {
    console.error('WhatsApp Disconnect Error:', error);
    res.status(500).json({ message: 'Failed to disconnect WhatsApp' });
  }
};

/**
 * Get WhatsApp session status
 */
export const getStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    let session = await WhatsAppSession.findOne({ userId });
    
    if (!session) {
      session = new WhatsAppSession({
        userId,
        sessionId: `session-${userId}`,
        status: 'Disconnected',
      });
      await session.save();
    }

    // Auto-heal connection if status is active but client is missing in memory
    const client = getWhatsAppClient(userId);
    if (!client && (session.status === 'Connected' || session.status === 'Connecting')) {
      console.log(`Auto-healing WhatsApp client for user ${userId} since status is ${session.status} but client is missing in memory.`);
      initWhatsAppClient(userId).catch((err) => {
        console.error(`Auto-heal failed for user ${userId}:`, err.message);
      });
    }
    
    res.json({
      status: session.status,
      qrCode: session.qrCode,
      connectedAt: session.connectedAt,
      disconnectedAt: session.disconnectedAt,
    });
  } catch (error) {
    console.error('WhatsApp Status Error:', error);
    res.status(500).json({ message: 'Failed to get WhatsApp session status' });
  }
};

/**
 * Update WhatsApp bio profile about status
 */
export const updateBio = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bio } = req.body;

    if (!bio || bio.trim() === '') {
      return res.status(400).json({ message: 'Bio content is required' });
    }

    const client = getWhatsAppClient(userId);
    if (!client) {
      return res.status(400).json({ message: 'WhatsApp connection is not active' });
    }

    await client.setStatus(bio);
    res.json({ message: 'WhatsApp bio status updated successfully' });
  } catch (error) {
    console.error('Update Bio Status Error:', error);
    res.status(500).json({ message: error.message || 'Failed to update WhatsApp bio status' });
  }
};

/**
 * Post a text or image status story to WhatsApp status
 */
export const postStory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { text, mediaUrl } = req.body;

    const client = getWhatsAppClient(userId);
    if (!client) {
      return res.status(400).json({ message: 'WhatsApp connection is not active' });
    }

    if (mediaUrl) {
      // Send image status story
      const absoluteMediaPath = resolveMediaPath(mediaUrl);
      if (fs.existsSync(absoluteMediaPath)) {
        const media = MessageMedia.fromFilePath(absoluteMediaPath);
        await client.sendMessage('status@broadcast', media, {
          caption: text || '',
        });
      } else {
        return res.status(404).json({ message: 'Status media attachment file not found' });
      }
    } else {
      // Send text-only status story
      if (!text || text.trim() === '') {
        return res.status(400).json({ message: 'Status story text or media is required' });
      }
      await client.sendMessage('status@broadcast', text);
    }

    res.json({ message: 'WhatsApp status story published successfully!' });
  } catch (error) {
    console.error('Post WhatsApp Status Story Error:', error);
    res.status(500).json({ message: error.message || 'Failed to publish WhatsApp status story' });
  }
};

