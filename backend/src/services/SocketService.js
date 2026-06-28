import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

let io = null;

const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Authenticate/identify user by userId passed in handshake
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    const joinUserRoom = (targetUserId) => {
      const normalizedUserId = targetUserId?.toString?.().trim();
      if (!normalizedUserId) {
        return;
      }
      socket.join(`user_${normalizedUserId}`);
      console.log(`User ${normalizedUserId} socket connected: ${socket.id}`);
    };

    if (userId) {
      joinUserRoom(userId);
    } else {
      console.log(`Anonymous socket connected: ${socket.id}`);
    }

    socket.on('subscribe-user', (payload) => {
      const targetUserId = payload?.userId;
      joinUserRoom(targetUserId);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user_${userId.toString()}`).emit(event, data);
  }
};

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
