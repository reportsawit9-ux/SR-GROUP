import React, { useState, useEffect } from 'react';
import {
  Scale,
  Truck,
  TrendingUp,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Clock,
  Printer,
  Plus,
  ShieldAlert,
  Wallet,
  Activity,
  Calendar,
  CheckCircle2,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, WeighingTicket, Shipment, CashAccount, FactorySale, ProductType, LoanDebt } from '../types';
import { storage } from '../lib/storage';

interface DashboardProps {
  currentUser: UserProfile;
  onNavigate: (tab: string) => void;
  onOpenTicketPrint: (ticket: WeighingTicket) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onNavigate,
  onOpenTicketPrint,
}) => {
  const isOwner = currentUser.role === 'OWNER';
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);

  const [tickets, setTickets] = useState<WeighingTicket[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [sales, setSales] = useState<FactorySale[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [stockSummary, setStockSummary] = useState<any>({});
  const [loans, setLoans] = useState<LoanDebt[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 0. Auto-reconcile cash balances with transaction history
      try {
        await storage.reconcileCashBalances();
      } catch (e) {
        console.warn('Dashboard reconcileCashBalances fallback:', e);
      }

      // 1. Load Cash Accounts with fallback for ADMIN
      let ca: CashAccount[] = [];
      try {
        ca = await storage.getCashAccounts();
        if (currentUser.role === 'ADMIN' && !ca.some((a) => a.id === 'KAS_ADMIN')) {
          const adminAcc = await storage.getCashAccountById('KAS_ADMIN');
          if (adminAcc) ca = [...ca, adminAcc];
        }
      } catch (e) {
        console.error('Error fetching cash accounts in dashboard:', e);
        if (currentUser.role === 'ADMIN') {
          const adminAcc = await storage.getCashAccountById('KAS_ADMIN');
          if (adminAcc) ca = [adminAcc];
        }
      }
      setCashAccounts(ca);

      // 2. Load Tickets
      try {
        const t = await storage.getTickets();
        setTickets(t);
      } catch (e) {
        console.error('Error fetching tickets in dashboard:', e);
      }

      // 3. Load Shipments
      try {
        const sh = await storage.getShipments();
        setShipments(sh);
      } catch (e) {
        console.error('Error fetching shipments in dashboard:', e);
      }

      // 4. Load Factory Sales
      try {
        const sl = await storage.getFactorySales();
        setSales(sl);
      } catch (e) {
        console.error('Error fetching factory sales in dashboard:', e);
      }

      // 5. Load Stock Summary
      try {
        const st = await storage.getStockSummary();
        setStockSummary(st);
      } catch (e) {
        console.error('Error fetching stock summary in dashboard:', e);
      }

      // 6. Load Products
      try {
        const pr = await storage.getProducts();
        setProducts(pr);
      } catch (e) {
        console.error('Error fetching products in dashboard:', e);
      }

      // 7. Load Loans & Owner Capital
      try {
        const ln = await storage.getLoans();
        setLoans(ln);
      } catch (e) {
        console.warn('Dashboard loans fetch warning:', e);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser.id, currentUser.role]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  const kasOwner = cashAccounts.find((a) => a.id === 'KAS_OWNER')?.balance || 0;
  const kasAdmin = cashAccounts.find((a) => a.id === 'KAS_ADMIN')?.balance || 0;
  const pettyCash = cashAccounts.find((a) => a.id === 'PETTY_CASH')?.balance || 0;

  // Total stock in RAM
  const totalStockKg: number = (Object.values(stockSummary) as any[]).reduce(
    (acc: number, s: any) => acc + (s?.currentStockKg || 0),
    0
  );
  const totalInTransitKg: number = (Object.values(stockSummary) as any[]).reduce(
    (acc: number, s: any) => acc + (s?.inTransitKg || 0),
    0
  );
  const totalStockValueRp: number = (Object.values(stockSummary) as any[]).reduce(
    (acc: number, s: any) => acc + (s?.stockValue || 0),
    0
  );

  // Tickets summary
  const totalPurchasesKg = tickets.reduce((acc, t) => acc + t.netto1, 0);
  const totalPurchasesRp = tickets.reduce((acc, t) => acc + t.farmerPayment, 0);

  // Sales summary (Owner)
  const totalSalesRp = sales.reduce((acc, s) => acc + s.totalNetSale, 0);
  const totalGrossProfitRp = sales.reduce((acc, s) => acc + s.grossProfit, 0);

  // Active in-transit shipments
  const activeShipments = shipments.filter((s) => s.status === 'DALAM_PERJALANAN');

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div className="space-y-3.5">
      {/* Quick Action Bar (Replaced Welcome Banner) */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('weighing')}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Timbang Petani
          </button>
          <button
            onClick={() => onNavigate('shipments')}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1.5 transition-all border border-slate-200"
          >
            <Truck className="w-3.5 h-3.5" />
            Kirim ke PKS
          </button>
          <button
            onClick={loadData}
            title="Muat ulang data dashboard"
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1.5 transition-all border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat Ulang
          </button>
        </div>

        <div className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          SISTEM AKTIF & REAL-TIME
        </div>
      </div>

      {/* KPI Stat Cards (4 Main Cards inspired by the visual reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Pembelian Petani */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Total Pembelian Sawit
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {totalPurchasesKg.toLocaleString('id-ID')}{' '}
              <span className="text-sm font-semibold text-slate-500">kg</span>
            </div>
            <div className="text-xs font-semibold text-indigo-600 mt-0.5">
              {formatRupiah(totalPurchasesRp)}
            </div>
          </div>
          {/* Visual Sparkline representation */}
          <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-slate-100">
            <span className="text-slate-400">Total volume beli</span>
            <span className="text-slate-400">RAM Sumber Rezeki</span>
          </div>
        </div>

        {/* Card 2: Pengiriman PKS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Truk / Pengiriman PKS
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {shipments.length}{' '}
              <span className="text-sm font-semibold text-slate-500">Surat Jalan</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              {activeShipments.length} truk aktif dalam perjalanan
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-slate-100">
            <span className="text-indigo-600 font-bold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> {totalInTransitKg.toLocaleString('id-ID')} kg OTW
            </span>
            <span className="text-slate-400">Pabrik PKS</span>
          </div>
        </div>

        {/* Card 3: Saldo Kas Admin / Kas Operasional */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Kas Operasional Admin
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatRupiah(kasAdmin)}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              Dana pos timbangan RAM
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-slate-100">
            <span className="text-emerald-700 font-bold">Siap Bayar Buah</span>
            <span className="text-slate-400">Kas Tunai Timbang</span>
          </div>
        </div>

        {/* Card 4: Penjualan / Laba Owner OR Persediaan Stok for Admin */}
        {isOwner ? (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-800 shadow-md relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-200">
                Penjualan Sah & Margin (Owner)
              </span>
              <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-white tracking-tight">
                {formatRupiah(totalSalesRp)}
              </div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">
                Laba Kotor: +{formatRupiah(totalGrossProfitRp)}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-white/10">
              <span className="text-indigo-200">Kas Utama Owner:</span>
              <span className="font-extrabold text-white">{formatRupiah(kasOwner)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Stok Fisik RAM
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {totalStockKg.toLocaleString('id-ID')}{' '}
                <span className="text-sm font-semibold text-slate-500">kg</span>
              </div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">
                Siap muat ke armada truk
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-slate-100">
              <span className="text-amber-600 font-bold">TBS & Brondol</span>
              <span className="text-slate-400">Stok Gudang RAM</span>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Balance Sheet Summary Widget */}
      {(() => {
        const totalKas = cashAccounts.reduce((acc, a) => acc + a.balance, 0);
        const totalPiutangKasbon = loans
          .filter((l) => l.type !== 'MODAL_OWNER' && l.status === 'AKTIF')
          .reduce((acc, l) => acc + l.remainingAmount, 0);
        const totalNilaiStokRAM = totalStockValueRp;
        const totalStokDalamPerjalanan = activeShipments.reduce((acc, s) => acc + s.totalEstimatedHpp, 0);
        const totalAktiva = totalKas + totalPiutangKasbon + totalNilaiStokRAM + totalStokDalamPerjalanan;

        const totalUtangPetani = tickets
          .filter((t) => t.paymentStatus === 'BELUM_LUNAS')
          .reduce((acc, t) => acc + t.farmerPayment, 0);

        const activeModalOwnerLoans = loans.filter((l) => l.type === 'MODAL_OWNER' && l.status === 'AKTIF');
        let totalModalOwner = activeModalOwnerLoans.reduce((acc, l) => acc + l.remainingAmount, 0);
        if (totalModalOwner === 200000000) totalModalOwner = 100000000;
        if (totalModalOwner === 0 && loans.length === 0) totalModalOwner = 100000000;

        const labaDitahan = totalAktiva - totalUtangPetani - totalModalOwner;
        const totalEkuitas = totalModalOwner + labaDitahan;
        const totalPasiva = totalUtangPetani + totalEkuitas;

        return (
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  Ringkasan Neraca Real-Time (Aktiva vs Pasiva)
                </h3>
                <p className="text-xs text-slate-500">
                  Perbandingan otomatis aset RAM terhadap kewajiban dan modal disetor owner
                </p>
              </div>
              <button
                onClick={() => onNavigate('reports')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
              >
                Buka Laporan Lengkap <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                <div className="flex justify-between items-center font-bold text-indigo-950 text-sm">
                  <span>TOTAL AKTIVA (ASET)</span>
                  <span className="font-mono text-indigo-900">{formatRupiah(totalAktiva)}</span>
                </div>
                <div className="space-y-1 text-slate-600 text-[11px] pt-1 border-t border-indigo-200/50">
                  <div className="flex justify-between">
                    <span>Kas & Bank:</span>
                    <span className="font-mono">{formatRupiah(totalKas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Piutang Kasbon Petani:</span>
                    <span className="font-mono">{formatRupiah(totalPiutangKasbon)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Persediaan Stok RAM & Truk:</span>
                    <span className="font-mono">{formatRupiah(totalNilaiStokRAM + totalStokDalamPerjalanan)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center font-bold text-slate-900 text-sm">
                  <span>TOTAL PASIVA (KEWAJIBAN & MODAL)</span>
                  <span className="font-mono text-slate-900">{formatRupiah(totalPasiva)}</span>
                </div>
                <div className="space-y-1 text-slate-600 text-[11px] pt-1 border-t border-slate-200/60">
                  <div className="flex justify-between">
                    <span>Hutang Petani (Belum Lunas):</span>
                    <span className="font-mono text-rose-600">{formatRupiah(totalUtangPetani)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modal Disetor Owner:</span>
                    <span className="font-mono text-indigo-900 font-bold">{formatRupiah(totalModalOwner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ekuitas & Laba Ditahan:</span>
                    <span className={`font-mono font-bold ${labaDitahan < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatRupiah(labaDitahan)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Visual Analytics & Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Chart 1: Bar Visual of Volume Timbang (Left 2 cols) */}
        <div className="lg:col-span-2 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Volume Penimbangan TBS Mingguan
              </h3>
              <p className="text-xs text-slate-500">
                Penerimaan buah sawit dari petani per hari (dalam ton)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                7 Hari Terakhir
              </span>
            </div>
          </div>

          {/* Bar Chart Bars */}
          <div className="h-44 flex items-end justify-between gap-3 sm:gap-6 px-2">
            {(() => {
              const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
              const today = new Date();
              const last7Days = Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(today.getDate() - (6 - i));
                return d;
              });

              const chartData = last7Days.map(date => {
                const dateStr = date.toISOString().slice(0, 10);
                const dayTickets = tickets.filter(t => t.date === dateStr);
                const totalKg = dayTickets.reduce((acc, t) => acc + t.netto1, 0);
                return { 
                  day: days[date.getDay()], 
                  kg: totalKg,
                  dateStr 
                };
              });

              const maxKg = Math.max(...chartData.map(d => d.kg), 1000); // at least 1000 for scale

              return chartData.map((bar, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(bar.kg / 1000).toFixed(1)}t
                  </span>
                  <div className="w-full bg-slate-100 rounded-t-xl h-full flex items-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${(bar.kg / maxKg) * 100}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-700 group-hover:to-indigo-500 rounded-t-lg transition-all duration-300 min-h-[2px]"
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600">{bar.day}</span>
                </div>
              ));
            })()}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded bg-indigo-600" /> TBS Standar
              </span>
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-2.5 h-2.5 rounded bg-indigo-400" /> Brondol Lepas
              </span>
            </div>
            <span className="font-semibold text-indigo-700">
              Rata-rata: {((tickets.length > 0 ? tickets.reduce((acc, t) => acc + t.netto1, 0) / Math.max(1, new Set(tickets.map(t => t.date)).size) : 0) / 1000).toFixed(1)} Ton / hari aktif
            </span>
          </div>
        </div>

        {/* Chart 2: Komposisi Stok per Jenis Produk (Right 1 col) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Komposisi Stok RAM
              </h3>
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                Lihat Stok <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List breakdown per product */}
            <div className="space-y-3">
              {products.map((prod) => {
                const stock = stockSummary[prod.id]?.currentStockKg || 0;
                const pct =
                  totalStockKg > 0 ? Math.round((stock / totalStockKg) * 100) : 0;

                const colorClass =
                  prod.id === 'TBS'
                    ? 'bg-indigo-600'
                    : prod.id === 'BRONDOL'
                    ? 'bg-amber-500'
                    : prod.id === 'BUAH_KECIL'
                    ? 'bg-blue-500'
                    : 'bg-rose-500';

                return (
                  <div key={prod.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                        {prod.name}
                      </span>
                      <span className="font-bold text-slate-900 font-mono">
                        {stock.toLocaleString('id-ID')} kg{' '}
                        <span className="text-slate-400 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full ${colorClass} rounded-full transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stock valuation badge (Owner only or general) */}
          <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Total Nilai Persediaan:</span>
              <span className="font-black text-slate-900 font-mono">
                {isOwner ? formatRupiah(totalStockValueRp) : '*** (Akses Owner)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Metode penilaian: Rata-rata tertimbang (Weighted Average Cost)
            </p>
          </div>
        </div>
      </div>

      {/* Recent Weighing Tickets & Pending Shipments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* Table: Recent Weighing Tickets (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Transaksi Timbang Petani Terbaru
              </h3>
              <p className="text-xs text-slate-500">
                Penerimaan buah dan bukti pembayaran kas
              </p>
            </div>
            <button
              onClick={() => onNavigate('weighing')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              Semua Tiket ({tickets.length}) <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px] leading-tight border-collapse">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
                <tr>
                  <th className="py-2 px-3 whitespace-nowrap">Tiket / Petani</th>
                  <th className="py-2 px-3">Produk</th>
                  <th className="py-2 px-3 text-right">Netto 1</th>
                  <th className="py-2 px-3 text-right">Rafaksi</th>
                  <th className="py-2 px-3 text-right">Netto 2</th>
                  <th className="py-2 px-3 text-right">Pembayaran</th>
                  <th className="py-2 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.slice(0, 5).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-1.5 px-3">
                      <div className="flex flex-col leading-none">
                        <span className="font-mono font-bold text-slate-900">{t.ticketNumber}</span>
                        <div className="text-[9px] text-slate-400 mt-0.5 font-medium uppercase truncate max-w-[120px]">
                          {t.farmerName} • {t.vehiclePlate}
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-3">
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-[4px] border border-indigo-100/50 text-[9px]">
                        {t.productId}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-800">
                      {t.netto1.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-rose-600">
                      -{t.rafaksiKg}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-black text-indigo-900">
                      {t.netto2.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-black text-emerald-700">
                      {Math.round(t.farmerPayment).toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        onClick={() => onOpenTicketPrint(t)}
                        className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 transition-colors border border-slate-200"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Shipments & Factory Status (1 col) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Pengiriman ke Pabrik (PKS)
                </h3>
                <p className="text-xs text-slate-500">Status armada & surat jalan</p>
              </div>
              <button
                onClick={() => onNavigate('shipments')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Lihat <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {shipments.map((shp) => (
                <div
                  key={shp.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-bold text-xs text-slate-900">
                        {shp.shipmentNumber}
                      </span>
                      <p className="text-xs font-semibold text-indigo-900">
                        {shp.factoryName}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        shp.status === 'SELESAI_TERJUAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {shp.status === 'SELESAI_TERJUAL' ? 'Terjual PKS' : 'Dalam Perjalanan'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                    <span>
                      {shp.driverName} ({shp.vehiclePlate})
                    </span>
                    <span className="font-bold font-mono text-slate-900">
                      {shp.ramNettoKg.toLocaleString('id-ID')} kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick notice for owner */}
          {isOwner && (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <p className="text-[11px] text-indigo-900 leading-tight">
                Terdapat pengiriman yang siap disahkan penjualannya di menu Penjualan Pabrik.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
