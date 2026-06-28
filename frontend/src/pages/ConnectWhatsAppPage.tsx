import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { 
  Link2, 
  Link2Off, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import type { RootState } from '../store';
import { updateStatus, setSessionLoading, setSessionError } from '../store/whatsappSlice';
import api from '../services/api';

const ConnectWhatsAppPage: React.FC = () => {
  const [localLoading, setLocalLoading] = useState(false);
  const dispatch = useDispatch();
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { status, qrCode, isLoading, error } = useSelector((state: RootState) => state.whatsapp);

  // Status management states
  const [activeTab, setActiveTab] = useState<'bio' | 'story'>('bio');
  const [bioText, setBioText] = useState('');
  const [storyText, setStoryText] = useState('');
  const [storyMediaUrl, setStoryMediaUrl] = useState('');
  const [storyMediaFile, setStoryMediaFile] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  const [statusError, setStatusErrorState] = useState<string | null>(null);
  const statusMediaInputRef = React.useRef<HTMLInputElement>(null);

  const handleStoryMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusLoading(true);
    setStatusErrorState(null);
    setStatusSuccess(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStoryMediaUrl(response.data.mediaUrl);
      setStoryMediaFile(response.data.fileName);
    } catch (err: any) {
      console.error(err);
      setStatusErrorState(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleRemoveStoryMedia = async () => {
    if (!storyMediaUrl) return;
    try {
      await api.post('/media/delete', { mediaUrl: storyMediaUrl });
      setStoryMediaUrl('');
      setStoryMediaFile('');
      if (statusMediaInputRef.current) statusMediaInputRef.current.value = '';
    } catch (err) {
      console.error('Error deleting story media:', err);
    }
  };

  const handleUpdateBio = async () => {
    if (!bioText.trim()) return;
    setStatusLoading(true);
    setStatusErrorState(null);
    setStatusSuccess(null);
    try {
      await api.post('/whatsapp/bio', { bio: bioText });
      setStatusSuccess('WhatsApp bio status updated successfully!');
      setBioText('');
    } catch (err: any) {
      console.error(err);
      setStatusErrorState(err.response?.data?.message || 'Failed to update bio status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePostStory = async () => {
    if (!storyText.trim() && !storyMediaUrl) return;
    setStatusLoading(true);
    setStatusErrorState(null);
    setStatusSuccess(null);
    try {
      await api.post('/whatsapp/story', { text: storyText, mediaUrl: storyMediaUrl });
      setStatusSuccess('WhatsApp status story published successfully!');
      setStoryText('');
      setStoryMediaUrl('');
      setStoryMediaFile('');
      if (statusMediaInputRef.current) statusMediaInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setStatusErrorState(err.response?.data?.message || 'Failed to publish status story.');
    } finally {
      setStatusLoading(false);
    }
  };


  useEffect(() => {
    if (!user?._id) {
      return;
    }

    // 1. Fetch current status from REST API
    const fetchStatus = async () => {
      dispatch(setSessionLoading(true));
      try {
        const response = await api.get('/whatsapp/status');
        dispatch(updateStatus({ 
          status: response.data.status, 
          qrCode: response.data.qrCode 
        }));
      } catch (err: any) {
        console.error('Error fetching WhatsApp status:', err);
        dispatch(setSessionError('Failed to fetch status'));
      } finally {
        dispatch(setSessionLoading(false));
      }
    };
    
    fetchStatus();

    // 2. Establish Socket.IO connection for real-time status and QR updates
    const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || undefined;
    const socket: Socket = io(socketBaseUrl, {
      path: '/socket.io',
      transports: ['polling'],
      auth: {
        userId: user._id,
      },
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected');
      socket.emit('subscribe-user', { userId: user._id });
    });

    socket.on('whatsapp-status', (data: { status: typeof status; qrCode: string }) => {
      console.log('Socket WhatsApp Status Update:', data);
      dispatch(updateStatus({ status: data.status, qrCode: data.qrCode }));
    });

    return () => {
      socket.disconnect();
    };
  }, [user?._id, dispatch]);

  const handleConnect = async () => {
    setLocalLoading(true);
    dispatch(setSessionError(null));
    try {
      await api.post('/whatsapp/connect');
      // Set state to Connecting while backend spins up browser
      dispatch(updateStatus({ status: 'Connecting', qrCode: '' }));
    } catch (err: any) {
      console.error(err);
      dispatch(setSessionError(err.response?.data?.message || 'Failed to initiate WhatsApp connection.'));
      dispatch(updateStatus({ status: 'Disconnected', qrCode: '' }));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect and clear your session?')) {
      return;
    }
    setLocalLoading(true);
    dispatch(setSessionError(null));
    try {
      await api.post('/whatsapp/disconnect');
      dispatch(updateStatus({ status: 'Disconnected', qrCode: '' }));
    } catch (err: any) {
      console.error(err);
      dispatch(setSessionError(err.response?.data?.message || 'Failed to disconnect session.'));
    } finally {
      setLocalLoading(false);
    }
  };

  const renderStatusCard = () => {
    switch (status) {
      case 'Connected':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in w-full">
            {/* Left Column: Connected Status */}
            <div className="lg:col-span-5 glass-card rounded-3xl p-8 border-emerald-500/10 text-center space-y-6 shadow-[0_8px_32px_rgba(16,185,129,0.05)]">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-white">Successfully Connected</h3>
                <p className="text-slate-400 text-[14px]">
                  Your personal WhatsApp account is linked and ready to broadcast messages.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleDisconnect}
                  disabled={localLoading}
                  className="w-full px-6 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-400 font-semibold text-sm transition-all flex items-center justify-center gap-2 mx-auto active:scale-[0.98]"
                >
                  {localLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2Off className="w-4 h-4" />
                  )}
                  Disconnect Account
                </button>
              </div>
            </div>

            {/* Right Column: WhatsApp Status Manager */}
            <div className="lg:col-span-7 glass-card rounded-3xl p-6 border-white/5 space-y-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-white">WhatsApp Status Manager</h3>
                <p className="text-slate-400 text-xs mt-0.5">Update profile info or publish stories to your contacts.</p>
              </div>

              {/* Success/Error Alerts */}
              {statusSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                  {statusSuccess}
                </div>
              )}
              {statusError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-semibold">
                  {statusError}
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-white/5">
                <button
                  onClick={() => { setActiveTab('bio'); setStatusSuccess(null); setStatusErrorState(null); }}
                  className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === 'bio' 
                      ? 'border-indigo-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Update About Info
                </button>
                <button
                  onClick={() => { setActiveTab('story'); setStatusSuccess(null); setStatusErrorState(null); }}
                  className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === 'story' 
                      ? 'border-indigo-500 text-white' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Publish Status Story
                </button>
              </div>

              {/* Tab Content */}
              {activeTab === 'bio' ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-slate-300">About/Bio Status Text</label>
                    <input
                      type="text"
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      placeholder="e.g. Available, Sleeping, WWBroadcast Active..."
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:border-indigo-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-slate-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleUpdateBio}
                    disabled={statusLoading || !bioText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
                  >
                    {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Update Profile Bio
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-slate-300">Story Text / Caption</label>
                    <textarea
                      value={storyText}
                      onChange={(e) => setStoryText(e.target.value)}
                      placeholder="What is on your mind? Broadcast a status story..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 focus:border-indigo-500/50 focus:bg-white/10 outline-none text-white transition-all placeholder:text-slate-500 text-sm resize-none"
                    />
                  </div>

                  {/* Media Upload */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-slate-300">Attach Media Image (Optional)</label>
                    {storyMediaUrl ? (
                      <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={`/${storyMediaUrl}`} alt="Status Media" className="w-10 h-10 rounded object-cover shrink-0" />
                          <span className="text-slate-200 truncate font-mono">{storyMediaFile}</span>
                        </div>
                        <button
                          onClick={handleRemoveStoryMedia}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-slate-400 font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => statusMediaInputRef.current?.click()}
                        className="border border-white/10 rounded-xl py-3 px-4 text-center cursor-pointer transition-all hover:bg-white/3 flex items-center justify-center gap-2 bg-white/1"
                      >
                        <input 
                          type="file" 
                          ref={statusMediaInputRef}
                          onChange={handleStoryMediaUpload}
                          accept="image/jpeg, image/png, image/webp"
                          className="hidden" 
                        />
                        <span className="text-slate-400 text-xs font-semibold">Choose Status Image</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handlePostStory}
                    disabled={statusLoading || (!storyText.trim() && !storyMediaUrl)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
                  >
                    {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Publish Status Story
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'Connecting':
        return (
          <div className="glass-card rounded-3xl p-8 border-white/5 max-w-xl mx-auto space-y-8 shadow-2xl">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-extrabold text-white">Link Account Session</h3>
              <p className="text-slate-400 text-sm">
                Open WhatsApp on your mobile phone and scan the QR code below.
              </p>
            </div>

            {qrCode ? (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl w-64 h-64 mx-auto flex items-center justify-center border border-white/10 shadow-lg shadow-white/5 relative group">
                  <img src={qrCode} alt="WhatsApp Web QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="max-w-md mx-auto bg-white/3 border border-white/5 rounded-2xl p-5 text-left space-y-3.5">
                  <h4 className="text-[14px] font-semibold text-white flex items-center gap-2">
                    <Smartphone className="w-4.5 h-4.5 text-indigo-400" /> Pairing Instructions:
                  </h4>
                  <ul className="text-slate-400 text-xs space-y-2 list-decimal list-inside pl-1">
                    <li>Open WhatsApp on your phone.</li>
                    <li>Tap Menu (Android) or Settings (iPhone) and select <b>Linked Devices</b>.</li>
                    <li>Tap <b>Link a Device</b>.</li>
                    <li>Point your phone screen to the QR code above to scan.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="text-slate-200 font-semibold text-sm">Initializing Automation Engine</p>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto">
                    Starting headless WhatsApp Web Chromium instance... this may take up to 20-30 seconds.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <button
                onClick={handleDisconnect}
                disabled={localLoading}
                className="px-6 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-sm transition-all inline-flex items-center gap-2 active:scale-[0.98]"
              >
                Cancel Connection
              </button>
            </div>
          </div>
        );
      case 'Session Expired':
        return (
          <div className="glass-card rounded-3xl p-8 border-rose-500/10 text-center max-w-md mx-auto space-y-6 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto animate-bounce">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold text-white">Session Expired</h3>
              <p className="text-slate-400 text-[14px]">
                Your WhatsApp login session has expired or was disconnected from your phone.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleConnect}
                disabled={localLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {localLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Reconnect Session
              </button>
              <button
                onClick={handleDisconnect}
                disabled={localLoading}
                className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 font-medium text-sm transition-all hover:bg-white/10"
              >
                Clear Cache
              </button>
            </div>
          </div>
        );
      default: // Disconnected
        return (
          <div className="glass-card rounded-3xl p-8 border-white/5 text-center max-w-md mx-auto space-y-6 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-slate-500/10 border border-slate-500/20 flex items-center justify-center text-slate-400 mx-auto">
              <Link2Off className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-extrabold text-white">Device Disconnected</h3>
              <p className="text-slate-400 text-[14px]">
                No WhatsApp account is linked to this platform. Click link below to generate QR code.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleConnect}
                disabled={localLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 mx-auto shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                {localLoading ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Link2 className="w-4.5 h-4.5" />
                )}
                Link WhatsApp Web
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
          Connect WhatsApp
        </h1>
        <p className="text-slate-400 text-[15px]">
          Scan the QR code to log into WhatsApp Web. Your session remains persistent until you manually disconnect.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && !qrCode && status === 'Connecting' ? (
        <div className="glass-card rounded-3xl p-12 border border-white/5 text-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
          <p className="text-slate-300 font-medium">Initializing WhatsApp automation engine...</p>
        </div>
      ) : (
        renderStatusCard()
      )}
    </div>
  );
};

export default ConnectWhatsAppPage;
