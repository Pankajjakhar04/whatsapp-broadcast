import xlsx from 'xlsx';
import { z } from 'zod';

// Schema for validating individual contact rows
const contactRowSchema = z.object({
  phoneNumber: z.string().min(8, 'Phone number too short').max(15, 'Phone number too long'),
  name: z.string().optional().default(''),
  company: z.string().optional().default(''),
  city: z.string().optional().default(''),
});

/**
 * Upload and parse contacts file (CSV/XLS/XLSX)
 */
export const uploadContacts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Read workbook from file buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Parse worksheet to JSON array of arrays or objects
    // header: 1 returns 2D array, which is safer for varying header names
    const rawRows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (rawRows.length < 2) {
      return res.status(400).json({ message: 'The uploaded file is empty or missing data rows' });
    }

    // Extract headers (first row) and lowercase them for flexible matching
    const headers = rawRows[0].map(h => String(h).trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    
    // Find column indexes
    const phoneIdx = headers.findIndex(h => ['phone_number', 'phonenumber', 'phone', 'mobile', 'number', 'contact'].includes(h));
    const nameIdx = headers.findIndex(h => ['name', 'full_name', 'fullname', 'contact_name'].includes(h));
    const companyIdx = headers.findIndex(h => ['company', 'organization', 'org', 'firm'].includes(h));
    const cityIdx = headers.findIndex(h => ['city', 'town', 'location'].includes(h));

    if (phoneIdx === -1) {
      return res.status(400).json({ 
        message: 'Could not find a phone number column. Make sure your header contains "phone_number", "phone" or "mobile".' 
      });
    }

    const contacts = [];
    let duplicatesCount = 0;
    let invalidCount = 0;
    const uniquePhones = new Set();

    // Loop through data rows (skip headers)
    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue; // skip empty rows

      const rawPhone = String(row[phoneIdx] || '').trim();
      const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
      const rawCompany = companyIdx !== -1 ? String(row[companyIdx] || '').trim() : '';
      const rawCity = cityIdx !== -1 ? String(row[cityIdx] || '').trim() : '';

      // Skip completely empty rows
      if (!rawPhone && !rawName && !rawCompany && !rawCity) continue;

      // Clean phone number (keep only digits)
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');

      // Validation
      if (!cleanPhone || cleanPhone.length < 9 || cleanPhone.length > 15) {
        invalidCount++;
        continue;
      }

      // Check duplicates
      if (uniquePhones.has(cleanPhone)) {
        duplicatesCount++;
        continue;
      }

      uniquePhones.add(cleanPhone);

      contacts.push({
        phoneNumber: cleanPhone,
        name: rawName,
        company: rawCompany,
        city: rawCity,
      });
    }

    res.json({
      success: true,
      contacts,
      stats: {
        totalParsed: rawRows.length - 1,
        validCount: contacts.length,
        duplicatesRemoved: duplicatesCount,
        invalidRemoved: invalidCount,
      }
    });
  } catch (error) {
    console.error('Upload Contacts Error:', error);
    res.status(500).json({ message: 'Failed to parse contacts file' });
  }
};

/**
 * Get sample template file
 */
export const getTemplate = (req, res) => {
  const format = req.query.format === 'excel' ? 'excel' : 'csv';

  const data = [
    { phone_number: '919876543210', name: 'John Doe', company: 'Acme Corp', city: 'New York' },
    { phone_number: '919812345678', name: 'David Smith', company: 'Stark Industries', city: 'Los Angeles' }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Contacts Template');

  if (format === 'excel') {
    // Generate Buffer for XLSX
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts_template.xlsx');
    return res.send(buffer);
  } else {
    // Generate CSV string
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts_template.csv');
    return res.send(csvContent);
  }
};
