import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { 
  Play, 
  Pause, 
  ArrowLeft, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock,
  Sparkles,
  Download
} from 'lucide-react';
import type { RootState } from '../store';
import api from '../services/api';
import type { Campaign } from '../types';

const MonitorCampaignPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // States
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const { user } = useSelector((state: RootState) => state.auth);

  // Fetch campaign info on load
  const fetchCampaign = async () => {
    try {
      const response = await api.get(`/campaigns/${id}`);
      setCampaign(response.data.campaign);
      
      // Load existing message logs as initial terminal data
      const parsedLogs = response.data.logs.map((log: any) => {
        const contact = log.contactId || { name: '', phoneNumber: '' };
        const name = contact.name || contact.phoneNumber;
        return `${log.status === 'Sent' ? '✅ Sent to' : '❌ Failed for'} ${name} (${contact.phoneNumber || ''})${log.errorMessage ? ': ' + log.errorMessage : ''}`;
      });
      setLogs(parsedLogs.reverse()); // Show chronologically
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to fetch campaign details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();

    // Setup socket connection
    const socket: Socket = io({
      auth: {
        userId: user?._id,
      },
    });

    socket.on('connect', () => {
      console.log('Monitor Socket connected');
    });

    // Listen to campaign progress
    socket.on('campaign-progress', (data: {
      campaignId: string;
      status: Campaign['status'];
      sentCount: number;
      failedCount: number;
      totalRecipients: number;
      log?: string;
    }) => {
      if (data.campaignId === id) {
        setCampaign((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            status: data.status,
            sentCount: data.sentCount,
            failedCount: data.failedCount,
            totalRecipients: data.totalRecipients,
          };
        });
        if (data.log) {
          setLogs((prev) => [...prev, data.log!]);
        }
      }
    });

    // Listen to log entries
    socket.on('campaign-log', (data: { campaignId: string; log: string }) => {
      if (data.campaignId === id) {
        setLogs((prev) => [...prev, data.log]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [id, user]);

  // Auto-scroll terminal log to bottom on new log
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Pause campaign handler
  const handlePause = async () => {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const response = await api.post(`/campaigns/${campaign._id}/pause`);
      setCampaign(response.data.campaign);
      setLogs((prev) => [...prev, `⚠️ User requested pause. Campaign paused.`]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to pause campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  // Resume campaign handler
  const handleResume = async () => {
    if (!campaign) return;
    setActionLoading(true);
    try {
      const response = await api.post(`/campaigns/${campaign._id}/resume`);
      setCampaign(response.data.campaign);
      setLogs((prev) => [...prev, `▶️ User requested resume. Re-queueing campaign...`]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resume campaign. Ensure WhatsApp is connected.');
    } finally {
      setActionLoading(false);
    }
  };

  // Download Report Excel/CSV
  const handleDownloadReport = async (format: 'csv' | 'excel') => {
    if (!campaign) return;
    try {
      const response = await api.get(`/reports/${campaign._id}?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign_report_${campaign._id}.${format === 'csv' ? 'csv' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error downloading report:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-slate-400 text-sm">Fetching campaign status...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="glass-card rounded-3xl p-8 border-rose-500/10 text-center max-w-md mx-auto space-y-5">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-white">Error Loading Monitor</h3>
        <p className="text-slate-400 text-sm">{error || 'Campaign details not found.'}</p>
        <button
          onClick={() => navigate('/history')}
          className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium text-sm transition-all"
        >
          Go Back to History
        </button>
      </div>
    );
  }

  const processedCount = campaign.sentCount + campaign.failedCount;
  const progressPercent = campaign.totalRecipients > 0 
    ? Math.round((processedCount / campaign.totalRecipients) * 100) 
    : 0;

  const getStatusBadge = () => {
    switch (campaign.status) {
      case 'Completed':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Running':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 animate-pulse';
      case 'Paused':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Failed':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/history')}
            className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-all hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                {campaign.campaignName}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge()}`}>
                {campaign.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1.5 font-mono">
              Campaign ID: {campaign._id}
            </p>
          </div>
        </div>

        {/* State controls & Reports Download */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {campaign.status === 'Running' && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-400 font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}

          {campaign.status === 'Paused' && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-indigo-600/20"
            >
              <Play className="w-4 h-4 fill-white" />
              Resume
            </button>
          )}

          {campaign.status === 'Completed' && (
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleDownloadReport('excel')}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-all flex items-center gap-1.5 justify-center"
              >
                <Download className="w-4.5 h-4.5" /> Excel Report
              </button>
              <button
                onClick={() => handleDownloadReport('csv')}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs transition-all flex items-center gap-1.5 justify-center"
              >
                <Download className="w-4.5 h-4.5" /> CSV Report
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Progress Gauge card */}
        <div className="lg:col-span-4 glass-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between space-y-8">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" /> Broadcast Progress
            </h3>
            <p className="text-slate-400 text-xs mt-1">Real-time campaigns analysis overview.</p>
          </div>

          {/* Radial progress representation */}
          <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
            {/* SVG circle meter */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="88"
                cy="88"
                r="74"
                className="stroke-white/5"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="88"
                cy="88"
                r="74"
                className="stroke-indigo-500 transition-all duration-500 ease-out"
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 74}
                strokeDashoffset={2 * Math.PI * 74 * (1 - progressPercent / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-white font-mono leading-none">
                {progressPercent}%
              </span>
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-1.5">
                Completed
              </span>
            </div>
          </div>

          {/* Stats Breakdown Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-center">
            <div className="p-3 bg-white/2 rounded-xl border border-white/5">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Total Recipients</span>
              <span className="text-xl font-bold text-white font-mono">{campaign.totalRecipients}</span>
            </div>
            <div className="p-3 bg-white/2 rounded-xl border border-white/5">
              <span className="text-[11px] font-medium text-slate-400 block mb-1">Unique Contacts</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">{campaign.uniqueRecipients ?? campaign.totalRecipients}</span>
            </div>
            <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
              <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Sent
              </span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{campaign.sentCount}</span>
            </div>
            <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
              <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center justify-center gap-1">
                <XCircle className="w-3 h-3 text-rose-400" /> Failed
              </span>
              <span className="text-xl font-bold text-rose-400 font-mono">{campaign.failedCount}</span>
            </div>
            <div className="p-3 bg-white/2 rounded-xl border border-white/5 col-span-2">
              <span className="text-[11px] font-medium text-slate-400 block mb-1 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Remaining
              </span>
              <span className="text-xl font-bold text-slate-200 font-mono">
                {campaign.totalRecipients - processedCount}
              </span>
            </div>
          </div>
        </div>

        {/* Live logs terminal ticker */}
        <div className="lg:col-span-8 glass-card rounded-3xl p-6 border border-white/5 flex flex-col justify-between min-h-[420px] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" /> Live Audit Log Ticker
            </h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${campaign.status === 'Running' ? 'bg-indigo-500 animate-ping' : 'bg-slate-500'}`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                {campaign.status === 'Running' ? 'Live Stream' : 'Idle'}
              </span>
            </div>
          </div>

          {/* Terminal Box */}
          <div 
            ref={logTerminalRef}
            className="flex-1 bg-black/45 border border-white/5 rounded-2xl p-5 font-mono text-[12.5px] leading-relaxed text-slate-300 overflow-y-auto space-y-2 select-text scrollbar-thin"
          >
            {logs.length === 0 ? (
              <div className="text-slate-500 h-full flex items-center justify-center italic text-center">
                Waiting for broadcast engine logs...
              </div>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index}
                  className={`py-0.5 border-l-2 pl-3 transition-colors ${
                    log.includes('✅') 
                      ? 'border-emerald-500/40 text-slate-300 hover:text-emerald-100' 
                      : log.includes('❌') 
                      ? 'border-rose-500/40 text-rose-300/90 hover:text-rose-200'
                      : 'border-indigo-500/40 text-indigo-300/90'
                  }`}
                >
                  <span className="text-slate-600 mr-2 text-[10px]">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  {log}
                </div>
              ))
            )}
          </div>

          {/* Tips / Config Footer */}
          <div className="bg-white/1 rounded-xl p-3.5 border border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span>Automation delay: <b>{campaign.delaySeconds}s</b> between recipients.</span>
            <span>Retries: <b>1 retry</b> for transient socket failures.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Loader spinner
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

export default MonitorCampaignPage;
