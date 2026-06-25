import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campaignName: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String, // Path of uploaded image, e.g., /uploads/campaigns/img.jpg
      default: '',
    },
    mediaType: {
      type: String, // e.g., image/jpeg
      default: '',
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    uniqueRecipients: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Running', 'Completed', 'Failed', 'Paused'],
      default: 'Pending',
    },
    delaySeconds: {
      type: Number,
      default: 20, // PRD Default: 20s
      min: 10,
      max: 60,
    },
  },
  {
    timestamps: true,
  }
);

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
