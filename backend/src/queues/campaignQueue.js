import { Queue, Worker } from 'bullmq';
import fs from 'fs';
import redisConfig from '../config/redis.js';
import { resolveMediaPath } from '../config/paths.js';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import MessageLog from '../models/MessageLog.js';
import { getWhatsAppClient, isClientReady, MessageMedia } from '../services/WhatsAppService.js';
import { emitToUser } from '../services/SocketService.js';

// Initialize campaign queue
export const campaignQueue = new Queue('campaignQueue', {
  connection: redisConfig,
});

const campaignWorkerConcurrency = Number.parseInt(process.env.CAMPAIGN_WORKER_CONCURRENCY ?? '1', 10);
const safeCampaignWorkerConcurrency = Number.isFinite(campaignWorkerConcurrency) && campaignWorkerConcurrency > 0
  ? campaignWorkerConcurrency
  : 1;

/**
 * Add a campaign processing job to the queue
 */
export const addCampaignJob = async (campaignId) => {
  const campaignIdStr = campaignId.toString();

  await campaignQueue.add(
    `process-campaign-${campaignIdStr}`,
    { campaignId: campaignIdStr },
    {
      jobId: campaignIdStr,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  console.log(`Enqueued campaign job: ${campaignIdStr}`);
};

// Helper delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worker definition
export const campaignWorker = new Worker(
  'campaignQueue',
  async (job) => {
    const campaignId = job.data.campaignId?.toString?.() ?? String(job.data.campaignId);
    console.log(`Starting worker for campaign: ${campaignId}`);

    // Fetch the campaign
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      console.error(`Campaign not found: ${campaignId}`);
      return;
    }

    // Double check status, if not running then stop
    if (campaign.status !== 'Running') {
      console.log(`Campaign ${campaignId} status is ${campaign.status}, skipping worker.`);
      return;
    }

    const userIdStr = campaign.userId.toString();

    // Check if WhatsApp client is ready
    if (!isClientReady(campaign.userId)) {
      console.error(`WhatsApp client is not ready for user: ${campaign.userId}`);
      campaign.status = 'Failed';
      await campaign.save();
      emitToUser(userIdStr, 'campaign-progress', {
        campaignId,
        status: 'Failed',
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        totalRecipients: campaign.totalRecipients,
        log: 'WhatsApp account is disconnected. Campaign failed.',
      });
      return;
    }

    const client = getWhatsAppClient(campaign.userId);

    // Fetch all contacts for this campaign
    const contacts = await Contact.find({ campaignId });
    console.log(`Processing ${contacts.length} contacts for campaign ${campaignId}`);

    // Pre-fetch all existing message logs to avoid N queries inside the loop
    const existingLogs = await MessageLog.find({ campaignId });
    const processedContactIds = new Set(
      existingLogs
        .filter(log => log.status === 'Sent')
        .map(log => log.contactId.toString())
    );
    const logsMap = new Map(
      existingLogs.map(log => [log.contactId.toString(), log])
    );

    let unsavedCampaignChanges = 0;

    // Loop through contacts sequentially
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const contactIdStr = contact._id.toString();

      // Refresh campaign status to detect pause/stop mid-way
      const currentCampaign = await Campaign.findById(campaignId);
      if (!currentCampaign) break;

      if (currentCampaign.status !== 'Running') {
        console.log(`Campaign ${campaignId} was paused or stopped. Suspending worker loop.`);
        return;
      }

      // Check if this contact was already processed (success)
      if (processedContactIds.has(contactIdStr)) {
        console.log(`Contact ${contact.phoneNumber} already sent. Skipping.`);
        continue;
      }

      // Try sending message
      let status = 'Sent';
      let errorMessage = '';
      
      // Personalize message
      let personalizedMessage = currentCampaign.message
        .replace(/{name}/g, contact.name || '')
        .replace(/{company}/g, contact.company || '')
        .replace(/{city}/g, contact.city || '');

      // Format phone number to WhatsApp format (e.g., 919876543210@c.us)
      // Remove any symbols, brackets, spaces, +
      let cleanPhone = contact.phoneNumber.replace(/[^0-9]/g, '');
      
      // Basic country code check: if length is 10 (no country code) and it's Indian, default to 91
      // For general purposes, we expect country code to be included as per validation rules.
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }
      
      let chatId = `${cleanPhone}@c.us`;

      try {
        // Resolve target WID/LID mapping if possible
        if (typeof client.getNumberId === 'function') {
          const numberId = await client.getNumberId(cleanPhone);
          if (numberId) {
            chatId = numberId._serialized;
          } else {
            throw new Error(`Phone number is not registered on WhatsApp`);
          }
        }

        if (currentCampaign.mediaUrl) {
          // Send image with caption
          const absoluteMediaPath = resolveMediaPath(currentCampaign.mediaUrl);
          
          if (fs.existsSync(absoluteMediaPath)) {
            const media = MessageMedia.fromFilePath(absoluteMediaPath);
            await client.sendMessage(chatId, media, {
              caption: personalizedMessage,
            });
          } else {
            throw new Error(`Media file not found on disk: ${currentCampaign.mediaUrl}`);
          }
        } else {
          // Send text only
          await client.sendMessage(chatId, personalizedMessage);
        }
      } catch (err) {
        console.error(`Failed to send to ${contact.phoneNumber}:`, err.message);
        status = 'Failed';
        errorMessage = err.message;
      }

      // Save log
      const existingLog = logsMap.get(contactIdStr);
      if (existingLog) {
        existingLog.status = status;
        existingLog.errorMessage = errorMessage;
        existingLog.sentAt = new Date();
        await existingLog.save();
      } else {
        const log = new MessageLog({
          campaignId,
          contactId: contact._id,
          status,
          errorMessage,
          sentAt: new Date(),
        });
        await log.save();
        logsMap.set(contactIdStr, log);
      }

      // Update campaign counts in memory
      if (status === 'Sent') {
        currentCampaign.sentCount += 1;
      } else {
        currentCampaign.failedCount += 1;
      }
      unsavedCampaignChanges++;

      // Batch save campaign updates to MongoDB every 10 contacts or on last contact
      if (unsavedCampaignChanges >= 10 || i === contacts.length - 1) {
        await currentCampaign.save();
        unsavedCampaignChanges = 0;
      }

      // Emit live updates to user
      emitToUser(userIdStr, 'campaign-progress', {
        campaignId,
        status: currentCampaign.status,
        sentCount: currentCampaign.sentCount,
        failedCount: currentCampaign.failedCount,
        totalRecipients: currentCampaign.totalRecipients,
      });

      emitToUser(userIdStr, 'campaign-log', {
        campaignId,
        log: `${status === 'Sent' ? '✅ Sent to' : '❌ Failed for'} ${contact.name || contact.phoneNumber} (${contact.phoneNumber})${errorMessage ? ': ' + errorMessage : ''}`,
      });

      // Introduce adaptive delay: delaySeconds + random (scaled down for faster settings)
      if (i < contacts.length - 1) {
        let totalDelay = currentCampaign.delaySeconds * 1000;
        if (currentCampaign.delaySeconds >= 5) {
          const randomOffset = Math.floor(Math.random() * 3000) + 2000; // 2-5s random offset
          totalDelay += randomOffset;
        } else if (currentCampaign.delaySeconds > 0) {
          const randomOffset = Math.floor(Math.random() * 500) + 100; // 100-600ms random offset
          totalDelay += randomOffset;
        }
        if (totalDelay > 0) {
          console.log(`Waiting ${totalDelay}ms before next message...`);
          await delay(totalDelay);
        }
      }
    }

    // Once finished, mark campaign completed
    const finalCampaign = await Campaign.findById(campaignId);
    if (finalCampaign && finalCampaign.status === 'Running') {
      finalCampaign.status = 'Completed';
      await finalCampaign.save();
      
      emitToUser(userIdStr, 'campaign-progress', {
        campaignId,
        status: 'Completed',
        sentCount: finalCampaign.sentCount,
        failedCount: finalCampaign.failedCount,
        totalRecipients: finalCampaign.totalRecipients,
      });

      emitToUser(userIdStr, 'campaign-log', {
        campaignId,
        log: `🏁 Campaign "${finalCampaign.campaignName}" completed successfully!`,
      });
    }
  },
  {
    connection: redisConfig,
    concurrency: safeCampaignWorkerConcurrency,
  }
);

campaignWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});
