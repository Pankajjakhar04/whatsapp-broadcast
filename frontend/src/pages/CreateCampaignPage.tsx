import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  Upload, 
  Download, 
  Sliders, 
  Image as ImageIcon, 
  Eye, 
  HelpCircle,
  AlertTriangle,
  Play,
  Users,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import type { RootState } from '../store';
import api from '../services/api';
import type { Contact } from '../types';

const CreateCampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(20);
  
  // Contacts states
  const [contacts, setContacts] = useState<Omit<Contact, '_id' | 'campaignId'>[]>([]);
  const [uploadStats, setUploadStats] = useState<{
    totalParsed: number;
    validCount: number;
    duplicatesRemoved: number;
    invalidRemoved: number;
  } | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  // Media states
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);

  // Submission state
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { status: whatsappStatus } = useSelector((state: RootState) => state.whatsapp);

  // Handle contact file upload
  const handleContactUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setContactsLoading(true);
    setContactsError(null);
    setUploadStats(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/contacts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setContacts(response.data.contacts);
      setUploadStats(response.data.stats);
    } catch (err: any) {
      console.error(err);
      setContactsError(err.response?.data?.message || 'Failed to parse contacts file. Ensure valid headers.');
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  // Handle template downloads
  const handleDownloadTemplate = async (format: 'csv' | 'excel') => {
    try {
      const response = await api.get(`/contacts/template?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contacts_template.${format === 'csv' ? 'csv' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error downloading template:', err);
    }
  };

  // Handle campaign image upload
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10MB limit.');
      return;
    }

    setMediaLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMediaUrl(response.data.mediaUrl);
      setMediaType(response.data.mediaType);
      setMediaFileName(response.data.fileName);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to upload media image.');
    } finally {
      setMediaLoading(false);
    }
  };

  // Handle campaign image removal
  const handleRemoveMedia = async () => {
    if (!mediaUrl) return;
    try {
      await api.post('/media/delete', { mediaUrl });
      setMediaUrl('');
      setMediaType('');
      setMediaFileName('');
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  };

  // Insert template variable tags at cursor position
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newValue = before + variable + after;
    setMessage(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Personalization preview string helper
  const getPersonalizedPreview = () => {
    if (!message) return 'Write a message on the left to see preview.';
    const sample = contacts[0] || { name: 'John', company: 'ABC Ltd', city: 'Mumbai' };
    return message
      .replace(/{name}/g, sample.name || 'John')
      .replace(/{company}/g, sample.company || 'ABC Ltd')
      .replace(/{city}/g, sample.city || 'Mumbai');
  };

  // Submit/Start Campaign
  const handleStartCampaign = async () => {
    setSubmitError(null);

    // Validations
    if (!campaignName.trim()) {
      setSubmitError('Campaign Name is required.');
      return;
    }
    if (contacts.length === 0) {
      setSubmitError('Please upload a valid contacts file with at least 1 recipient.');
      return;
    }
    if (!message.trim()) {
      setSubmitError('Message body cannot be empty.');
      return;
    }
    if (whatsappStatus !== 'Connected') {
      setSubmitError('WhatsApp session is disconnected. You must connect your account first.');
      return;
    }

    setSubmitLoading(true);

    try {
      // 1. Create campaign
      const response = await api.post('/campaigns', {
        campaignName,
        message,
        delaySeconds,
        mediaUrl,
        mediaType,
        contacts,
      });

      const campaignId = response.data._id;

      // 2. Start campaign immediately
      await api.post(`/campaigns/${campaignId}/start`);

      // 3. Navigate to monitor screen
      navigate(`/monitor/${campaignId}`);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.response?.data?.message || 'Failed to create and launch campaign.');
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
          Create Campaign
        </h1>
        <p className="text-slate-400 text-[15px]">
          Design a message template, upload contacts, and launch your automated broadcast campaign.
        </p>
      </div>

      {whatsappStatus !== 'Connected' && (
        <div className="flex items-center gap-3.5 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300">
          <AlertTriangle className="w-6 h-6 shrink-0 text-amber-400" />
          <div className="text-sm">
            <span className="font-bold">Warning:</span> Your WhatsApp account is disconnected. You can compile the campaign details, but you must scan the QR code to pair your device under <a href="/connect" className="underline font-semibold hover:text-amber-200">Connect WhatsApp</a> before starting the broadcast.
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-center gap-3.5 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div className="text-sm font-medium">{submitError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Creation forms */}
        <div className="lg:col-span-7 space-y-8">
          {/* Card 1: Upload Recipients */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> 1. Upload Contacts
            </h3>

            {/* Drag & Drop File Zone */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-indigo-500/30 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-white/2 bg-black/10 group"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleContactUpload}
                accept=".csv, .xlsx, .xls"
                className="hidden" 
              />
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3 group-hover:text-indigo-400 group-hover:scale-110 transition-all duration-300" />
              {contactsLoading ? (
                <div className="space-y-1.5">
                  <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                  <p className="text-slate-300 text-sm font-semibold">Parsing contact list...</p>
                </div>
              ) : contacts.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> File parsed successfully
                  </p>
                  <p className="text-slate-400 text-xs">{contacts.length} valid contacts loaded.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-slate-300 text-sm font-semibold">Drag & Drop Contacts or Click to Upload</p>
                  <p className="text-slate-500 text-xs">Supports Excel (.xlsx, .xls) and CSV files. Max 10MB.</p>
                </div>
              )}
            </div>

            {/* Validation Banner Stats */}
            {uploadStats && (
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white/3 border border-white/5 text-xs text-slate-400">
                <div>Total Parsed: <span className="font-semibold text-white font-mono">{uploadStats.totalParsed}</span></div>
                <div>Valid Recipients: <span className="font-semibold text-emerald-400 font-mono">{uploadStats.validCount}</span></div>
                <div>Duplicates Dropped: <span className="font-semibold text-amber-400 font-mono">{uploadStats.duplicatesRemoved}</span></div>
                <div>Invalid Numbers Dropped: <span className="font-semibold text-rose-400 font-mono">{uploadStats.invalidRemoved}</span></div>
              </div>
            )}

            {contactsError && (
              <div className="p-3 text-rose-400 bg-rose-500/10 border border-rose-500/20 text-xs rounded-xl">
                {contactsError}
              </div>
            )}

            {/* Template Download Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-white/5 text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-slate-500" /> Need a formatting sample?
              </span>
              <div className="flex gap-2.5">
                <button
                  onClick={() => handleDownloadTemplate('csv')}
                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV Template
                </button>
                <button
                  onClick={() => handleDownloadTemplate('excel')}
                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel Template
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Campaign Settings */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" /> 2. Campaign Setup
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Campaign name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-slate-300 px-0.5">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Summer Clearance Sale"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:border-indigo-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-slate-500 text-sm"
                />
              </div>

              {/* Delay seconds slider */}
              <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center px-0.5">
                  <label className="text-[13px] font-medium text-slate-300">Message Interval Delay</label>
                  <span className="text-[13px] font-bold text-indigo-400 font-mono">{delaySeconds}s</span>
                </div>
                <div className="flex items-center gap-3.5 h-[46px]">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {delaySeconds < 5 && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold animate-pulse mt-1">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>Warning: Low delays (&lt; 5s) significantly increase the risk of WhatsApp banning your account. Use with caution.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Media/Image upload widget */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-slate-300 px-0.5">Campaign Media Attachment (Optional)</label>
              
              {mediaUrl ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-lg border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                      <img src={`/${mediaUrl}`} alt="Media upload" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-slate-200 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                        {mediaFileName}
                      </span>
                      <span className="text-slate-500 text-[11px] font-mono">{mediaType}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveMedia}
                    className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-slate-400"
                    title="Remove Image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div 
                  onClick={() => mediaInputRef.current?.click()}
                  className="border border-white/10 rounded-xl py-4.5 px-4 text-center cursor-pointer transition-all hover:bg-white/3 flex items-center justify-center gap-2.5 bg-white/1"
                >
                  <input 
                    type="file" 
                    ref={mediaInputRef}
                    onChange={handleMediaUpload}
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden" 
                  />
                  {mediaLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <span className="text-slate-400 text-sm font-medium">Uploading attachment...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 text-indigo-400" />
                      <span className="text-slate-400 text-sm font-medium">Attach Campaign Image</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Message Composer */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" /> 3. Compose Template
              </h3>
              
              {/* Insert Tags Chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => insertVariable('{name}')}
                  className="px-2.5 py-1 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-400 hover:text-indigo-300 font-semibold text-xs font-mono transition-all"
                  title="Insert Name Tag"
                >
                  + name
                </button>
                <button
                  onClick={() => insertVariable('{company}')}
                  className="px-2.5 py-1 rounded-lg border border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/15 text-purple-400 hover:text-purple-300 font-semibold text-xs font-mono transition-all"
                  title="Insert Company Tag"
                >
                  + company
                </button>
                <button
                  onClick={() => insertVariable('{city}')}
                  className="px-2.5 py-1 rounded-lg border border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/15 text-pink-400 hover:text-pink-300 font-semibold text-xs font-mono transition-all"
                  title="Insert City Tag"
                >
                  + city
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="flex flex-col gap-1.5">
              <textarea
                id="message-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your broadcast message. Use {name}, {company}, or {city} tags for personalization variables."
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:border-indigo-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-slate-500 text-sm resize-y leading-relaxed font-sans"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Message Preview and Contacts list */}
        <div className="lg:col-span-5 space-y-8">
          {/* Card 4: Live Message Preview */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" /> Live Preview
            </h3>

            {/* Mock phone/whatsapp UI representation */}
            <div className="rounded-2xl bg-[#0b141a] border border-white/5 overflow-hidden font-sans">
              {/* Mock Header */}
              <div className="bg-[#128c7e] py-3.5 px-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-700 flex items-center justify-center text-emerald-100 font-bold text-sm">
                  {contacts[0]?.name?.charAt(0) || 'J'}
                </div>
                <div>
                  <h4 className="text-white text-sm font-semibold leading-tight">
                    {contacts[0]?.name || 'John'}
                  </h4>
                  <span className="text-emerald-100/70 text-[11px] font-mono leading-none">
                    +{contacts[0]?.phoneNumber || '919876543210'}
                  </span>
                </div>
              </div>

              {/* Mock Message Area */}
              <div 
                className="p-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover min-h-[220px] flex flex-col justify-end"
              >
                {/* Whatsapp bubble */}
                <div className="glass-panel border-white/5 bg-[#005c4b]/85 text-slate-100 rounded-2xl rounded-tr-none p-3 max-w-[85%] ml-auto text-[13.5px] leading-relaxed shadow-sm relative space-y-2.5">
                  
                  {/* Embedded image */}
                  {mediaUrl && (
                    <div className="rounded-lg overflow-hidden border border-black/10">
                      <img src={`/${mediaUrl}`} alt="Attachment preview" className="w-full max-h-[160px] object-cover" />
                    </div>
                  )}

                  {/* Body text */}
                  <div className="whitespace-pre-wrap font-sans text-slate-100">
                    {getPersonalizedPreview()}
                  </div>
                  
                  <span className="text-[10px] text-slate-300 font-mono block text-right">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: Recipients Preview Table */}
          {contacts.length > 0 && (
            <div className="glass-card rounded-3xl p-6 border border-white/5 space-y-3.5">
              <h3 className="text-base font-bold text-white flex items-center justify-between">
                <span>Recipients Preview</span>
                <span className="text-xs text-indigo-400 font-mono">({contacts.length} total)</span>
              </h3>

              <div className="max-h-[200px] overflow-y-auto border border-white/5 rounded-xl bg-black/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/3 border-b border-white/5 text-slate-400 font-semibold uppercase tracking-wider sticky top-0">
                      <th className="px-3 py-2.5">Phone</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Company</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-400 font-mono">
                    {contacts.slice(0, 20).map((c, index) => (
                      <tr key={index} className="hover:bg-white/1">
                        <td className="px-3 py-2 text-slate-200">+{c.phoneNumber}</td>
                        <td className="px-3 py-2 truncate max-w-[90px]">{c.name || '-'}</td>
                        <td className="px-3 py-2 truncate max-w-[90px]">{c.company || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {contacts.length > 20 && (
                <p className="text-[11px] text-slate-500 text-center">
                  Showing first 20 recipients of {contacts.length}.
                </p>
              )}
            </div>
          )}

          {/* Action Trigger Card */}
          <div className="glass-card rounded-3xl p-6 border border-white/5 text-center">
            <button
              onClick={handleStartCampaign}
              disabled={submitLoading || mediaLoading}
              className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold transition-all duration-300 flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-50 text-[15px]"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Launching Campaign...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  Launch Broadcast Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper spin loader
const Loader2: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={`animate-spin ${className}`} 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export default CreateCampaignPage;
