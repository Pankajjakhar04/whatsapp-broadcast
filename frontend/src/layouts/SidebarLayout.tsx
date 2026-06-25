import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  LayoutDashboard, 
  QrCode, 
  PlusCircle, 
  History, 
  LogOut, 
  User, 
  Menu, 
  X,
  MessageSquareDot
} from 'lucide-react';
import type { RootState } from '../store';
import { clearCredentials } from '../store/authSlice';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

const SidebarLayout: React.FC<SidebarLayoutProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { user } = useSelector((state: RootState) => state.auth);
  const { status: whatsappStatus } = useSelector((state: RootState) => state.whatsapp);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Connect WhatsApp', href: '/connect', icon: QrCode },
    { name: 'Create Campaign', href: '/create-campaign', icon: PlusCircle },
    { name: 'Campaign History', href: '/history', icon: History },
  ];

  const handleLogout = () => {
    dispatch(clearCredentials());
    navigate('/login');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Connected':
        return 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
      case 'Connecting':
        return 'bg-amber-500 animate-pulse';
      case 'Session Expired':
        return 'bg-rose-500 animate-pulse';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#030712] text-slate-100 selection:bg-indigo-500/30">
      {/* Mobile Navbar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 glass-panel border-b border-white/5 z-50">
        <div className="flex items-center gap-2">
          <MessageSquareDot className="w-8 h-8 text-indigo-500" />
          <span className="font-semibold text-lg tracking-wider text-gradient font-sans">
            WWBROADCAST
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar for Desktop / Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:sticky md:top-0 md:h-screen md:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-72 glass-panel border-r border-white/5 flex flex-col justify-between`}
      >
        <div className="flex flex-col p-6 overflow-y-auto flex-1">
          {/* Logo */}
          <div className="hidden md:flex items-center gap-3 mb-10 px-2">
            <MessageSquareDot className="w-10 h-10 text-indigo-500 animate-pulse" />
            <span className="font-bold text-xl tracking-wider text-gradient font-sans">
              WWBROADCAST
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all duration-300 group ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                  }`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info / Logout */}
        <div className="p-5 border-t border-white/5 bg-black/20 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                <User className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-medium text-slate-200 truncate max-w-[130px]">
                  {user?.name || 'User'}
                </span>
                <span className="text-[11px] text-slate-500 truncate max-w-[130px]">
                  {user?.email || 'email@acme.com'}
                </span>
              </div>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-1.5" title={`WhatsApp: ${whatsappStatus}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(whatsappStatus)}`} />
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2.5 w-full py-3 px-4 rounded-xl border border-white/5 hover:border-rose-500/20 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 font-medium transition-all duration-300"
          >
            <LogOut className="w-4.5 h-4.5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Drawer Overlay for Mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
        />
      )}
    </div>
  );
};

export default SidebarLayout;
