import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  History, 
  Search, 
  Trash2, 
  Download, 
  Eye,
  AlertTriangle,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import api from '../services/api';
import type { Campaign } from '../types';

const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // States
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/campaigns');
      setCampaigns(response.data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch campaign history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign? This will permanently erase the message logs, contacts, and statistics.')) {
      return;
    }

    try {
      await api.delete(`/campaigns/${campaignId}`);
      setCampaigns((prev) => prev.filter((c) => c._id !== campaignId));
    } catch (err) {
      console.error('Error deleting campaign:', err);
      alert('Failed to delete campaign.');
    }
  };

  const handleDownloadReport = async (campaignId: string, format: 'csv' | 'excel') => {
    try {
      const response = await api.get(`/reports/${campaignId}?format=${format}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign_report_${campaignId}.${format === 'csv' ? 'csv' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error('Error downloading report:', err);
    }
  };

  const handleRerun = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to run this campaign again for the same contacts? This will create a new campaign instance and begin broadcasting.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/campaigns/${campaignId}/rerun`);
      const newCampaignId = response.data._id;
      navigate(`/monitor/${newCampaignId}`);
    } catch (err: any) {
      console.error('Error re-running campaign:', err);
      alert(err.response?.data?.message || 'Failed to re-run campaign. Verify that your WhatsApp device is connected.');
      setLoading(false);
    }
  };

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

  const filteredCampaigns = campaigns.filter((c) =>
    c.campaignName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2 flex items-center gap-2.5">
            <History className="w-9 h-9 text-indigo-500" /> Campaign History
          </h1>
          <p className="text-slate-400 text-[15px]">
            Audit previous broadcast reports, track running campaigns, and export CSV/Excel sheets.
          </p>
        </div>
        <button
          onClick={fetchCampaigns}
          className="p-3 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-all hover:bg-white/10"
          title="Refresh List"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Search and Filters */}
      <div className="glass-card rounded-2xl p-4 border border-white/5 flex items-center max-w-md">
        <Search className="w-5 h-5 text-slate-500 ml-1 mr-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search campaigns by name..."
          className="w-full bg-transparent outline-none border-none text-slate-200 text-sm placeholder:text-slate-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-3xl p-12 border border-white/5 text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading campaigns log...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 border border-white/5 text-center py-20 space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <p className="text-slate-300 font-semibold text-sm">No campaigns match your search</p>
            <p className="text-slate-500 text-xs mt-1">Try searching for a different name or create a new campaign.</p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/3 border-b border-white/5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Campaign Name</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Recipients</th>
                  <th className="px-6 py-4">Success</th>
                  <th className="px-6 py-4">Failed</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 text-[14px]">
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign._id} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-semibold text-white truncate max-w-[200px]" title={campaign.campaignName}>
                      {campaign.campaignName}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(campaign.createdAt).toLocaleDateString()} {new Date(campaign.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-200" title="Total Recipients / Unique Phone Numbers">
                      {campaign.totalRecipients} <span className="text-xs font-normal text-slate-500 font-sans">({campaign.uniqueRecipients ?? campaign.totalRecipients})</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{campaign.sentCount}</td>
                    <td className="px-6 py-4 font-mono text-rose-400">{campaign.failedCount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Monitor/View */}
                        <button
                          onClick={() => navigate(`/monitor/${campaign._id}`)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-600/10 hover:border-indigo-500/30 hover:text-white transition-all text-slate-400"
                          title="Monitor Campaign"
                        >
                          <Eye className="w-4.5 h-4.5" />
                        </button>
                        
                        {/* Download Excel */}
                        <button
                          onClick={() => handleDownloadReport(campaign._id, 'excel')}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-emerald-600/10 hover:border-emerald-500/30 hover:text-white transition-all text-slate-400"
                          title="Download Excel Report"
                        >
                          <Download className="w-4.5 h-4.5" />
                        </button>

                        {/* Re-run */}
                        <button
                          onClick={() => handleRerun(campaign._id)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-indigo-600/10 hover:border-indigo-500/30 hover:text-white transition-all text-slate-400"
                          title="Re-run Campaign"
                        >
                          <RefreshCw className="w-4.5 h-4.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(campaign._id)}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 transition-all text-slate-400"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
