import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    company: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;
