export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  token?: string;
}

export interface WhatsAppSession {
  status: 'Connected' | 'Disconnected' | 'Connecting' | 'Session Expired';
  qrCode: string;
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface Campaign {
  _id: string;
  userId: string;
  campaignName: string;
  message: string;
  mediaUrl: string;
  mediaType: string;
  totalRecipients: number;
  uniqueRecipients?: number;
  sentCount: number;
  failedCount: number;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Paused';
  delaySeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  _id: string;
  campaignId: string;
  phoneNumber: string;
  name: string;
  company: string;
  city: string;
}

export interface MessageLog {
  _id: string;
  campaignId: string;
  contactId: {
    _id: string;
    phoneNumber: string;
    name: string;
  } | string;
  status: 'Sent' | 'Failed';
  errorMessage: string;
  sentAt: string;
}

export interface Template {
  _id: string;
  userId: string;
  templateName: string;
  message: string;
  createdAt: string;
}
