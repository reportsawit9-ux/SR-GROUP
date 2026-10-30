import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Search,
  Bell,
  Database,
  RefreshCw,
  LogOut,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { storage } from '../lib/storage';

interface NavbarProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onOpenSupabaseModal: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onOpenSupabaseModal,
  searchTerm,
  onSearchChange,
  activeTab,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [ramName, setRamName] = useState('RAM SUMBER REZEKI');

  useEffect(() => {
    storage.getSettings().then((s) => {
      if (s?.ramName) setRamName(s.ramName);
    });

    const handleSettingsChanged = (e: any) => {
      if (e?.detail?.ramName) {
        setRamName(e.detail.ramName);
      }
    };

    window.addEventListener('ram_settings_changed', handleSettingsChanged);
    return () => {
      window.removeEventListener('ram_settings_changed', handleSettingsChanged);
    };
  }, []);

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Ringkasan Eksekutif';
      case 'weighing':
        return 'Timbang Petani & Cetak Tiket';
      case 'purchases':
        return 'Rekap Pembelian & Komisi';
      case 'inventory':
        return 'Persediaan & Stok Opname';
      case 'shipments':
        return 'Pengiriman ke Pabrik (Surat Jalan)';
      case 'factory_sales':
        return 'Penjualan Pabrik & Timbang PKS';
      case 'cash':
        return 'Manajemen Kas & Pengeluaran';
      case 'loans':
        return 'Utang & Piutang (Kasbon / Modal)';
      case 'reports':
        return 'Laporan Laba Rugi & Neraca';
      case 'master_data':
        return 'Master Data & Pengaturan Harga';
      case 'audit_logs':
        return 'Audit Trail & Log Aktivitas';
      default:
        return `Sistem ${ramName}`;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 sm:px-5 py-2.5 flex items-center justify-between gap-3 transition-all">
      {/* Left: Current Section Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {ramName}
          </span>
          <span className="text-slate-300">/</span>
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {getTabTitle(activeTab)}
          </h1>
        </div>
      </div>

      {/* Middle: Universal Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari tiket, petani, nomor polisi, surat jalan..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200/60 rounded px-1.5 py-0.5"
            >
              ESC
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* Supabase Status Button (Khusus Owner) */}
        {currentUser.role === 'OWNER' && (
          <button
            onClick={onOpenSupabaseModal}
            title="Status Sinkronisasi & Konfigurasi Database Supabase (Khusus Owner)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200/80 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-800">Database</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </button>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            aria-label="Notifikasi sistem"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
          </button>
        </div>

        {/* Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-xs"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                currentUser.role === 'OWNER'
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xs'
                  : 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xs'
              }`}
            >
              {currentUser.role === 'OWNER' ? 'HR' : 'SR'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                    currentUser.role === 'OWNER'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {currentUser.email}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Menu Pengguna
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  ID: {currentUser.id.slice(0, 8)}...
                </p>
              </div>

              <div className="p-1">
                <div className="px-3 py-2 text-[11px] text-slate-600 leading-relaxed">
                  Status: <span className="text-emerald-600 font-bold">AKTIF</span><br />
                  Terdaftar: {new Date(currentUser.created_at || '').toLocaleDateString('id-ID')}
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all mt-1 hover:bg-rose-50 text-rose-600 font-bold text-xs"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <span>Keluar dari Sistem</span>
              </button>

              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between px-2 text-[10px] text-slate-400">
                <span>Versi 2.0.0 • Supabase Auth</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
