import xlsx from 'xlsx';
import path from 'path';
import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import MessageLog from '../models/MessageLog.js';

/**
 * Export campaign report (CSV/Excel)
 */
export const downloadReport = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const format = req.query.format === 'excel' ? 'excel' : 'csv';

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({
      _id: campaignId,
      userId: req.user._id,
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Fetch all contacts
    const contacts = await Contact.find({ campaignId });

    // Fetch all message logs
    const logs = await MessageLog.find({ campaignId });

    // Map logs by contact ID
    const logMap = new Map();
    logs.forEach(log => {
      logMap.set(log.contactId.toString(), log);
    });

    // Build JSON data for sheet
    const reportRows = contacts.map((contact) => {
      const log = logMap.get(contact._id.toString());
      return {
        'Campaign Name': campaign.campaignName,
        'Phone Number': contact.phoneNumber,
        'Name': contact.name || '-',
        'Company': contact.company || '-',
        'City': contact.city || '-',
        'Media Sent': campaign.mediaUrl ? 'Yes' : 'No',
        'Media Filename': campaign.mediaUrl ? path.basename(campaign.mediaUrl) : '-',
        'Status': log ? log.status : 'Pending',
        'Sent Time': log && log.status === 'Sent' ? log.sentAt.toISOString() : '-',
        'Failure Reason': log && log.status === 'Failed' ? log.errorMessage : '-',
      };
    });

    // Create workbook and sheet using SheetJS
    const worksheet = xlsx.utils.json_to_sheet(reportRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Campaign Report');

    for (let row = 2; row <= reportRows.length + 1; row++) {
      const phoneCellAddress = `B${row}`;
      if (worksheet[phoneCellAddress]) {
        worksheet[phoneCellAddress].t = 's';
        worksheet[phoneCellAddress].z = '@';
        worksheet[phoneCellAddress].v = String(worksheet[phoneCellAddress].v ?? '');
      }
    }

    // Auto-fit column widths
    const maxLen = reportRows.reduce((w, r) => {
      Object.keys(r).forEach((k, idx) => {
        const len = String(r[k]).length;
        w[idx] = Math.max(w[idx] || 0, len, k.length);
      });
      return w;
    }, []);
    worksheet['!cols'] = maxLen.map(l => ({ wch: l + 3 }));

    // Set headers and response depending on format
    if (format === 'excel') {
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=campaign_report_${campaignId}.xlsx`);
      return res.send(buffer);
    } else {
      const csvContent = xlsx.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=campaign_report_${campaignId}.csv`);
      return res.send(csvContent);
    }
  } catch (error) {
    console.error('Download Report Error:', error);
    res.status(500).json({ message: 'Failed to generate campaign report' });
  }
};
