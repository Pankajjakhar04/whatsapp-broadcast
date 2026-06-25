import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  BarChart3, 
  Users, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  QrCode,
  ArrowRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import type { RootState } from '../store';
import { updateStatus } from '../store/whatsappSlice';
import api from '../services/api';
import type { Campaign } from '../types';

const DashboardPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { status: whatsappStatus } = useSelector((state: RootState) => state.whatsapp);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch campaigns
      const response = await api.get('/campaigns');
      setCampaigns(response.data);

      // Fetch WhatsApp status
      const wsResponse = await api.get('/whatsapp/status');
      dispatch(updateStatus({ 
        status: wsResponse.data.status, 
        qrCode: wsResponse.data.qrCode 
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Poll dashboard campaigns occasionally (e.g. every 10s) to show live updates
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute Stats
  const totalCampaigns = campaigns.length;
  const totalContacts = campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0);
  const totalUniqueContacts = campaigns.reduce((sum, c) => sum + (c.uniqueRecipients || c.totalRecipients || 0), 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0);

  const getStatusStyle = (status: string) => {
    switch (status) {
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

  const getWhatsAppBanner = () => {
    switch (whatsappStatus) {
      case 'Connected':
        return (
          <div className="glass-panel border-emerald-500/15 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(16,185,129,0.05)]">
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">WhatsApp Connected</h3>
                <p className="text-slate-400 text-sm mt-0.5">Your messaging session is active. You can run campaigns.</p>
              </div>
            </div>
            <Link
              to="/connect"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-all"
            >
              Session Config
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        );
      case 'Connecting':
        return (
          <div className="glass-panel border-amber-500/15 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(245,158,11,0.05)]">
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Connecting WhatsApp Session</h3>
                <p className="text-slate-400 text-sm mt-0.5">Initial session handshake is running. Click to check QR code scanner.</p>
              </div>
            </div>
            <Link
              to="/connect"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-400 hover:text-amber-300 font-medium text-sm transition-all"
            >
              Open QR Scanner
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        );
      default:
        return (
          <div className="glass-panel border-rose-500/15 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(244,63,94,0.05)]">
            <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                <QrCode className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">WhatsApp Disconnected</h3>
                <p className="text-slate-400 text-sm mt-0.5">You must link your WhatsApp account before you can broadcast messages.</p>
              </div>
            </div>
            <Link
              to="/connect"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-medium text-sm transition-all"
            >
              Connect Session
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-none mb-2">
            Overview Dashboard
          </h1>
          <p className="text-slate-400 text-[15px]">
            Monitor connection states, recent broadcasts, and delivery success ratios.
          </p>
        </div>
        <Link
          to="/create-campaign"
          className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all duration-300 flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
        >
          <MessageSquare className="w-4.5 h-4.5" />
          Create Broadcast
        </Link>
      </div>

      {/* WhatsApp banner status */}
      {getWhatsAppBanner()}

      {/* Grid of stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Campaigns */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center justify-between group hover:border-indigo-500/20 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Broadcasts</span>
            <h4 className="text-3xl font-extrabold text-white">{totalCampaigns}</h4>
            <span className="text-indigo-400 text-[11px] font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Campaigns logged
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-300">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Contacts */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center justify-between group hover:border-purple-500/20 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Contacts</span>
            <h4 className="text-3xl font-extrabold text-white">
              {totalContacts} <span className="text-sm font-normal text-slate-400 font-sans">({totalUniqueContacts} unique)</span>
            </h4>
            <span className="text-purple-400 text-[11px] font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Uploaded recipients
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform duration-300">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Messages Sent */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center justify-between group hover:border-emerald-500/20 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Messages Sent</span>
            <h4 className="text-3xl font-extrabold text-white">{totalSent}</h4>
            <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Successful deliveries
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Failed Messages */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex items-center justify-between group hover:border-rose-500/20 transition-all duration-300">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Failed Messages</span>
            <h4 className="text-3xl font-extrabold text-white">{totalFailed}</h4>
            <span className="text-rose-400 text-[11px] font-medium flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Blocked or invalid
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform duration-300">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent Campaign Activities list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> Recent Broadcast Campaigns
          </h2>
          <Link
            to="/history"
            className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors"
          >
            View All History →
          </Link>
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-12 border border-white/5 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 border border-white/5 text-center">
            <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-[15px] font-medium">No campaign history found.</p>
            <p className="text-slate-500 text-xs mt-1">Upload contact file and compose template to get started.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/3 border-b border-white/5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Campaign Name</th>
                    <th className="px-6 py-4">Created Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Delivery Progress</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-[14px]">
                  {campaigns.slice(0, 5).map((campaign) => (
                    <tr key={campaign._id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{campaign.campaignName}</td>
                      <td className="px-6 py-4">
                        {new Date(campaign.createdAt).toLocaleDateString()} {new Date(campaign.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-full max-w-[120px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500" 
                              style={{ 
                                width: `${campaign.totalRecipients > 0 ? ((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100 : 0}%` 
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 font-mono" title="Processed / Total Recipients (Unique)">
                             {campaign.sentCount + campaign.failedCount}/{campaign.totalRecipients} <span className="text-slate-500 font-sans">({campaign.uniqueRecipients ?? campaign.totalRecipients} unique)</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/monitor/${campaign._id}`)}
                          className="px-3.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-600/10 hover:border-indigo-500/30 hover:text-white transition-all text-xs font-medium"
                        >
                          {campaign.status === 'Running' ? 'Monitor' : 'Details'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
