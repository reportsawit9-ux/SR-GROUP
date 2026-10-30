import React from 'react';
import {
  LayoutDashboard,
  Scale,
  ShoppingBag,
  Truck,
  Building2,
  PackageCheck,
  Wallet,
  HandCoins,
  FileSpreadsheet,
  Users,
  History,
  Lock,
  ChevronRight,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
  onLogout,
}) => {
  const isOwner = currentRole === 'OWNER';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    ownerOnly?: boolean;
    badge?: string;
    description: string;
  }

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Ringkasan operasional & KPI',
    },
    {
      id: 'weighing',
      label: 'Timbang Petani',
      icon: Scale,
      description: 'Input tiket & cetak nota timbang',
    },
    {
      id: 'purchases',
      label: 'Pembelian & Komisi',
      icon: ShoppingBag,
      description: 'Rincian pembayaran & affiliate',
    },
    {
      id: 'inventory',
      label: 'Persediaan Stok',
      icon: PackageCheck,
      description: 'Stok TBS & kartu stok opname',
    },
    {
      id: 'shipments',
      label: 'Pengiriman Pabrik',
      icon: Truck,
      description: 'Surat jalan ke pabrik kelapa sawit',
    },
    {
      id: 'factory_sales',
      label: 'Penjualan Pabrik',
      icon: Building2,
      ownerOnly: false,
      badge: 'PKS',
      description: 'Timbang PKS, susut & harga jual',
    },
    {
      id: 'cash',
      label: 'Kas & Pengeluaran',
      icon: Wallet,
      description: isOwner ? 'Kas Owner, Admin & Petty Cash' : 'Kas Operasional Admin',
    },
    {
      id: 'loans',
      label: 'Utang & Piutang',
      icon: HandCoins,
      ownerOnly: false, // Admin can view/input kasbon, Owner controls all
      description: 'Kasbon petani, sopir & modal',
    },
    {
      id: 'reports',
      label: 'Laporan Keuangan',
      icon: FileSpreadsheet,
      ownerOnly: true,
      badge: 'Owner',
      description: 'Laba rugi, neraca & analisa',
    },
    {
      id: 'master_data',
      label: 'Master Data',
      icon: Users,
      description: 'Petani, PKS, armada & harga',
    },
    {
      id: 'audit_logs',
      label: 'Audit Trail',
      icon: History,
      ownerOnly: false,
      description: 'Log riwayat seluruh aktivitas',
    },
  ];

  const handleItemClick = (item: NavItem) => {
    if (item.ownerOnly && !isOwner) {
      alert(
        `Akses Terbatas: Menu "${item.label}" hanya dapat diakses oleh Owner RAM SUMBER REZEKI.`
      );
      return;
    }
    onTabChange(item.id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-white border-r border-slate-200 z-50 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  SUMBER REZEKI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Sistem Timbang & Keuangan
              </p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Current Active Role Badge Box */}
        <div className="p-4 mx-4 my-3 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOwner ? 'bg-indigo-600' : 'bg-emerald-500'
                }`}
              />
              <span className="text-xs font-bold text-slate-800">
                Mode: {currentRole}
              </span>
            </div>
            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                isOwner
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isOwner ? 'Super Admin' : 'Staff Timbang'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            {isOwner
              ? 'Melihat seluruh transaksi, laba rugi, kas owner & pengesahan PKS.'
              : 'Operasional timbang, pembelian, pengiriman & kas admin harian.'}
          </p>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 py-1 scrollbar-thin">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Operasional RAM
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isLocked = item.ownerOnly && !isOwner;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`w-full group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all text-xs font-medium ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : isLocked
                    ? 'text-slate-400 hover:bg-slate-50 cursor-not-allowed opacity-75'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-500/30 text-white'
                        : isLocked
                        ? 'text-slate-400'
                        : 'text-slate-500 group-hover:text-indigo-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold">{item.label}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isLocked && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                      <Lock className="w-2.5 h-2.5" />
                      Owner
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-white/70" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium">Sistem Berjalan Normal</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Timbangan terintegrasi & pergerakan stok real-time.
            </p>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100/50 transition-colors border border-transparent hover:border-rose-100"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>
    </>
  );
};
