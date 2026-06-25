import { z } from 'zod';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import MessageLog from '../models/MessageLog.js';
import { isClientReady } from '../services/WhatsAppService.js';
import { addCampaignJob } from '../queues/campaignQueue.js';

// Input validators
const campaignCreateSchema = z.object({
  campaignName: z.string().min(1, 'Campaign Name is required'),
  message: z.string().min(1, 'Message body is required'),
  delaySeconds: z.number().min(0).max(60).default(20),
  mediaUrl: z.string().optional().default(''),
  mediaType: z.string().optional().default(''),
  contacts: z.array(
    z.object({
      phoneNumber: z.string().min(8),
      name: z.string().optional().default(''),
      company: z.string().optional().default(''),
      city: z.string().optional().default(''),
    })
  ).min(1, 'At least one contact is required'),
});

/**
 * Create a campaign and its contacts
 */
export const createCampaign = async (req, res) => {
  try {
    const parseResult = campaignCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { campaignName, message, delaySeconds, mediaUrl, mediaType, contacts } = parseResult.data;

    // Calculate unique recipients
    const uniquePhones = new Set(
      contacts.map(c => {
        let clean = c.phoneNumber.replace(/[^0-9]/g, '');
        if (clean.length === 10) {
          clean = '91' + clean;
        }
        return clean;
      })
    );

    // Create Campaign
    const campaign = new Campaign({
      userId: req.user._id,
      campaignName,
      message,
      delaySeconds,
      mediaUrl,
      mediaType,
      totalRecipients: contacts.length,
      uniqueRecipients: uniquePhones.size,
      status: 'Pending',
    });

    const savedCampaign = await campaign.save();

    // Map and Bulk Insert Contacts
    const contactDocs = contacts.map(c => ({
      campaignId: savedCampaign._id,
      phoneNumber: c.phoneNumber,
      name: c.name,
      company: c.company,
      city: c.city,
    }));

    await Contact.insertMany(contactDocs);

    res.status(201).json(savedCampaign);
  } catch (error) {
    console.error('Create Campaign Error:', error);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
};

/**
 * List campaigns for logged in user
 */
export const getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Get Campaigns Error:', error);
    res.status(500).json({ message: 'Failed to retrieve campaigns' });
  }
};

/**
 * Get campaign by ID with logs
 */
export const getCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Fetch contacts
    const contacts = await Contact.find({ campaignId: campaign._id });

    // Fetch recent message logs
    const logs = await MessageLog.find({ campaignId: campaign._id })
      .populate('contactId', 'phoneNumber name')
      .sort({ sentAt: -1 });

    res.json({
      campaign,
      contacts,
      logs,
    });
  } catch (error) {
    console.error('Get Campaign Error:', error);
    res.status(500).json({ message: 'Failed to retrieve campaign details' });
  }
};

/**
 * Start a campaign
 */
export const startCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'Completed') {
      return res.status(400).json({ message: 'Campaign has already completed' });
    }

    // Verify WhatsApp Client is ready
    if (!isClientReady(req.user._id)) {
      return res.status(400).json({ 
        message: 'WhatsApp connection is not active. Please scan the QR code first.' 
      });
    }

    // Set status to Running
    campaign.status = 'Running';
    await campaign.save();

    // Trigger worker job
    await addCampaignJob(campaign._id);

    res.json({ message: 'Campaign started successfully', campaign });
  } catch (error) {
    console.error('Start Campaign Error:', error);
    res.status(500).json({ message: 'Failed to start campaign' });
  }
};

/**
 * Pause a running campaign
 */
export const pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'Running') {
      return res.status(400).json({ message: 'Only running campaigns can be paused' });
    }

    campaign.status = 'Paused';
    await campaign.save();

    res.json({ message: 'Campaign paused successfully', campaign });
  } catch (error) {
    console.error('Pause Campaign Error:', error);
    res.status(500).json({ message: 'Failed to pause campaign' });
  }
};

/**
 * Resume a paused campaign
 */
export const resumeCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status !== 'Paused') {
      return res.status(400).json({ message: 'Only paused campaigns can be resumed' });
    }

    // Verify WhatsApp Client is ready
    if (!isClientReady(req.user._id)) {
      return res.status(400).json({ 
        message: 'WhatsApp connection is not active. Please connect before resuming.' 
      });
    }

    campaign.status = 'Running';
    await campaign.save();

    // Trigger worker job again
    await addCampaignJob(campaign._id);

    res.json({ message: 'Campaign resumed successfully', campaign });
  } catch (error) {
    console.error('Resume Campaign Error:', error);
    res.status(500).json({ message: 'Failed to resume campaign' });
  }
};

/**
 * Delete a campaign and its associated records
 */
export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Delete related message logs
    await MessageLog.deleteMany({ campaignId: campaign._id });

    // Delete related contacts
    await Contact.deleteMany({ campaignId: campaign._id });

    // Delete the campaign
    await Campaign.deleteOne({ _id: campaign._id });

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete Campaign Error:', error);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
};

/**
 * Re-run an existing campaign for the same contacts
 */
export const rerunCampaign = async (req, res) => {
  try {
    const originalCampaign = await Campaign.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!originalCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Verify WhatsApp Client is ready
    if (!isClientReady(req.user._id)) {
      return res.status(400).json({ 
        message: 'WhatsApp connection is not active. Please connect your account first.' 
      });
    }

    // Fetch all contacts for this campaign
    const originalContacts = await Contact.find({ campaignId: originalCampaign._id });
    if (originalContacts.length === 0) {
      return res.status(400).json({ message: 'Original campaign has no contacts to broadcast.' });
    }

    // Create a new cloned campaign
    const newCampaign = new Campaign({
      userId: req.user._id,
      campaignName: `${originalCampaign.campaignName} (Re-run)`,
      message: originalCampaign.message,
      delaySeconds: originalCampaign.delaySeconds,
      mediaUrl: originalCampaign.mediaUrl,
      mediaType: originalCampaign.mediaType,
      totalRecipients: originalCampaign.totalRecipients,
      uniqueRecipients: originalCampaign.uniqueRecipients,
      status: 'Running', // Set running immediately
    });

    const savedCampaign = await newCampaign.save();

    // Map and Bulk Insert Contacts pointing to the new campaign
    const newContactDocs = originalContacts.map(c => ({
      campaignId: savedCampaign._id,
      phoneNumber: c.phoneNumber,
      name: c.name,
      company: c.company,
      city: c.city,
    }));

    await Contact.insertMany(newContactDocs);

    // Trigger worker job
    await addCampaignJob(savedCampaign._id);

    res.status(201).json(savedCampaign);
  } catch (error) {
    console.error('Rerun Campaign Error:', error);
    res.status(500).json({ message: 'Failed to rerun campaign' });
  }
};

