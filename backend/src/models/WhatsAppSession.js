import mongoose from 'mongoose';

const whatsappSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One session per user in MVP
    },
    sessionId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Connected', 'Disconnected', 'Connecting', 'Session Expired'],
      default: 'Disconnected',
    },
    qrCode: {
      type: String, // Store base64 QR code representation
      default: '',
    },
    connectedAt: {
      type: Date,
    },
    disconnectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const WhatsAppSession = mongoose.model('WhatsAppSession', whatsappSessionSchema);
export default WhatsAppSession;
