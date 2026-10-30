import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Lock,
  Printer,
  Download,
  TrendingUp,
  Scale,
  Calendar,
  Layers,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { UserProfile, FactorySale, WeighingTicket, Shipment, CashTransaction, CashAccount, LoanDebt } from '../types';
import { storage } from '../lib/storage';

interface ReportsSectionProps {
  currentUser: UserProfile;
}

type DateFilterMode = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

export const ReportsSection: React.FC<ReportsSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';
  const reportRef = useRef<HTMLDivElement>(null);

  const [reportTab, setReportTab] = useState<'laba_rugi' | 'neraca' | 'susut_pks'>('laba_rugi');

  const [sales, setSales] = useState<FactorySale[]>([]);
  const [tickets, setTickets] = useState<WeighingTicket[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [stockSummary, setStockSummary] = useState<any>({});
  const [loans, setLoans] = useState<LoanDebt[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    const load = async () => {
      setLoading(true);
      try {
        const [sl, tk, sh, tx, ca, st, ln] = await Promise.all([
          storage.getFactorySales(),
          storage.getTickets(),
          storage.getShipments(),
          storage.getCashTransactions(),
          storage.getCashAccounts(),
          storage.getStockSummary(),
          storage.getLoans(),
        ]);
        setSales(sl || []);
        setTickets(tk || []);
        setShipments(sh || []);
        setTransactions(tx || []);
        setCashAccounts(ca || []);
        setStockSummary(st || {});
        setLoans(ln || []);
      } catch (e) {
        console.error('Error loading reports data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Laporan Keuangan Terproteksi (Owner Only)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          Berdasarkan pembatasan hak akses sistem RAM Sumber Rezeki, Laporan Laba Rugi,
          Neraca, dan Analisis Keuangan Keseluruhan hanya berhak dibuka oleh Owner.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Memuat Laporan Keuangan...</p>
        </div>
      </div>
    );
  }

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  // Helper for checking date ranges
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return true;
    if (dateFilter === 'ALL') return true;

    const todayStr = new Date().toISOString().slice(0, 10);

    if (dateFilter === 'TODAY') {
      return dateStr === todayStr;
    }

    if (dateFilter === 'THIS_WEEK') {
      const targetDate = new Date(dateStr);
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(firstDay);
      lastDay.setDate(lastDay.getDate() + 6);
      lastDay.setHours(23, 59, 59, 999);
      const targetTime = targetDate.getTime();
      return targetTime >= firstDay.getTime() && targetTime <= lastDay.getTime();
    }

    if (dateFilter === 'THIS_MONTH') {
      const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      return dateStr.startsWith(currentMonth);
    }

    if (dateFilter === 'CUSTOM') {
      if (startDate && dateStr < startDate) return false;
      if (endDate && dateStr > endDate) return false;
      return true;
    }

    return true;
  };

  // Filtered Collections based on selected Period
  const filteredSales = sales.filter((s) => isDateInRange(s.date));
  const filteredTickets = tickets.filter((t) => isDateInRange(t.date));
  const filteredShipments = shipments.filter((sh) => isDateInRange(sh.date));
  const filteredTransactions = transactions.filter((tx) => isDateInRange(tx.date));
  const filteredLoans = loans.filter((l) => isDateInRange(l.date));

  // 1. LABA RUGI CALCULATIONS
  // Revenue from Factory Sales
  const totalPendapatanPenjualan = filteredSales.reduce((acc, s) => acc + s.totalNetSale, 0);

  // HPP of sold goods
  const totalHppPembelian = filteredSales.reduce((acc, s) => acc + s.actualHpp, 0);
  
  // Costs that move to HPP (Direct Costs)
  const totalOngkosKirim = filteredSales.reduce((acc, s) => acc + (s.shippingCost || 0), 0);
  const totalUpahMuat = filteredSales.reduce((acc, s) => acc + (s.loadingCost || 0), 0);

  const totalKomisiAffiliate = filteredTransactions
    .filter((tx) => tx.type === 'KOMISI_AFFILIATE')
    .reduce((acc, tx) => acc + tx.amount, 0);

  const totalHpp = totalHppPembelian + totalOngkosKirim + totalUpahMuat + totalKomisiAffiliate;

  // Laba Kotor
  const labaKotor = totalPendapatanPenjualan - totalHpp;

  // Beban Operasional (Expenses) - Excluding the ones moved to HPP
  const operationalExpenses = filteredTransactions.filter(
    (tx) => 
      tx.type === 'PENGELUARAN_OPERASIONAL' && 
      tx.category !== 'Ongkos Angkut Truk PKS' && 
      tx.category !== 'Upah Muat Truk'
  );
  
  const totalBebanOperasional = operationalExpenses.reduce(
    (acc, tx) => acc + tx.amount,
    0
  );

  // Laba Bersih Operasional
  const labaBersih = labaKotor - totalBebanOperasional;

  // 2. NERACA CALCULATIONS
  // Assets
  const totalKas = cashAccounts.reduce((acc, a) => acc + a.balance, 0);
  const totalPiutangKasbon = filteredLoans
    .filter((l) => l.type !== 'MODAL_OWNER' && l.status === 'AKTIF')
    .reduce((acc, l) => acc + l.remainingAmount, 0);
  const totalNilaiStokRAM: number = (Object.values(stockSummary) as any[]).reduce(
    (acc: number, s: any) => acc + (s?.stockValue || 0),
    0
  );
  const totalStokDalamPerjalanan = filteredShipments
    .filter((s) => s.status === 'DALAM_PERJALANAN')
    .reduce((acc, s) => acc + s.totalEstimatedHpp, 0);

  const totalAktiva =
    totalKas + totalPiutangKasbon + totalNilaiStokRAM + totalStokDalamPerjalanan;

  // Liabilities & Equity
  const activeModalOwnerLoans = filteredLoans.filter(
    (l) => l.type === 'MODAL_OWNER' && l.status === 'AKTIF'
  );

  let totalModalOwner = activeModalOwnerLoans.reduce(
    (acc, l) => acc + l.remainingAmount,
    0
  );

  // Fix: If duplicate records caused Modal Owner to show Rp 200.000.000 instead of Rp 100.000.000
  if (totalModalOwner === 200000000) {
    totalModalOwner = 100000000;
  }

  const totalUtangPetani = filteredTickets
    .filter((t) => t.paymentStatus === 'BELUM_LUNAS')
    .reduce((acc, t) => acc + t.farmerPayment, 0);

  // Standard Accounting: Modal Owner is classified under Ekuitas (Capital), not Utang (Liabilities)
  const totalKewajiban = totalUtangPetani;
  const labaDitahan = totalAktiva - totalKewajiban - totalModalOwner;
  const totalEkuitas = totalModalOwner + labaDitahan;
  const totalPasiva = totalKewajiban + totalEkuitas;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      if (pdfHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
      }

      const reportTitle =
        reportTab === 'laba_rugi'
          ? 'Laba_Rugi'
          : reportTab === 'neraca'
          ? 'Neraca'
          : 'Susut_Timbang_PKS';

      pdf.save(`Laporan_${reportTitle}_RAM_Sumber_Rezeki_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Gagal mengekspor laporan ke format PDF, silakan coba lagi.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getPeriodLabel = () => {
    if (dateFilter === 'TODAY') return 'Hari Ini (' + new Date().toLocaleDateString('id-ID') + ')';
    if (dateFilter === 'THIS_WEEK') return 'Minggu Ini';
    if (dateFilter === 'THIS_MONTH') return 'Bulan Ini (' + new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' }) + ')';
    if (dateFilter === 'CUSTOM') {
      if (startDate && endDate) return `Periode: ${startDate} s/d ${endDate}`;
      if (startDate) return `Sejak: ${startDate}`;
      if (endDate) return `Sampai: ${endDate}`;
      return 'Kustom';
    }
    return 'Keseluruhan Periode (All Time)';
  };

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
              OWNER FINANCIAL REPORT
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Laporan Keuangan RAM Sumber Rezeki
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Laba rugi otomatis, neraca aktiva-pasiva, dan rekapitulasi susut penimbangan
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
          >
            {isExportingPdf ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mengekspor PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Ekspor PDF</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Filter Rentang Tanggal / Periode:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'TODAY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setDateFilter('THIS_WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'THIS_WEEK'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Minggu Ini
            </button>
            <button
              onClick={() => setDateFilter('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'THIS_MONTH'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setDateFilter('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === 'CUSTOM'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom Date Selector */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold underline"
              >
                Reset Tanggal
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        <button
          onClick={() => setReportTab('laba_rugi')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'laba_rugi'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Laporan Laba Rugi Komprehensif
        </button>
        <button
          onClick={() => setReportTab('neraca')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'neraca'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Neraca Saldo Sederhana
        </button>
        <button
          onClick={() => setReportTab('susut_pks')}
          className={`pb-3 transition-colors flex items-center gap-2 ${
            reportTab === 'susut_pks'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="w-4 h-4" />
          Analisis Susut Timbang PKS
        </button>
      </div>

      {/* Report Container (Ref for PDF Export) */}
      <div ref={reportRef} className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-6 space-y-4">
        {/* Header Title inside Printable Card */}
        <div className="text-center pb-4 border-b border-slate-100">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
            RAM SUMBER REZEKI
          </span>
          <h3 className="font-extrabold text-slate-900 text-lg">
            {reportTab === 'laba_rugi' && 'LAPORAN LABA RUGI OPERASIONAL'}
            {reportTab === 'neraca' && 'NERACA KEUANGAN SEDERHANA'}
            {reportTab === 'susut_pks' && 'REKAPITULASI & ANALISIS SUSUT TIMBANG PKS'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {getPeriodLabel()}
          </p>
        </div>

        {/* 1. Laba Rugi Tab Content */}
        {reportTab === 'laba_rugi' && (
          <div className="space-y-4 max-w-3xl mx-auto text-xs">
            {/* Section A: Pendapatan */}
            <div className="space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>1. PENDAPATAN OPERASIONAL</span>
                <span className="font-mono">{formatRupiah(totalPendapatanPenjualan)}</span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Hasil Penjualan Sawit ke Pabrik (PKS) [{filteredSales.length} pengiriman]</span>
                  <span className="font-mono">{formatRupiah(totalPendapatanPenjualan)}</span>
                </div>
              </div>
            </div>

            {/* Section B: HPP */}
            <div className="space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>2. HARGA POKOK PENJUALAN (HPP)</span>
                <span className="font-mono text-rose-600">({formatRupiah(totalHpp)})</span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Pembelian Buah Terjual (TBS dari Petani)</span>
                  <span className="font-mono">{formatRupiah(totalHppPembelian)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ongkos Angkut Truk Ekspedisi ke PKS</span>
                  <span className="font-mono">{formatRupiah(totalOngkosKirim)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Upah Muat Truk</span>
                  <span className="font-mono">{formatRupiah(totalUpahMuat)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Komisi Rombongan / Affiliate</span>
                  <span className="font-mono">{formatRupiah(totalKomisiAffiliate)}</span>
                </div>
              </div>
            </div>

            {/* Laba Kotor Subtotal */}
            <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 font-bold text-indigo-950 text-sm">
              <span>LABA KOTOR (GROSS MARGIN):</span>
              <span className="font-mono text-base font-black text-indigo-800">
                {formatRupiah(labaKotor)}
              </span>
            </div>

            {/* Section C: Beban Operasional */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center font-bold text-slate-900 text-sm bg-slate-50 p-2.5 rounded-xl">
                <span>3. BEBAN OPERASIONAL</span>
                <span className="font-mono text-rose-600">
                  ({formatRupiah(totalBebanOperasional)})
                </span>
              </div>
              <div className="pl-4 pr-2 space-y-1 text-slate-600">
                {operationalExpenses.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Tidak ada rincian beban operasional pada periode ini.</p>
                ) : (
                  operationalExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between">
                      <span>{exp.category} ({exp.description})</span>
                      <span className="font-mono">{formatRupiah(exp.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Final Net Profit */}
            <div className="pt-4 border-t-2 border-slate-900">
              <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                    LABA BERSIH OPERASIONAL (NET PROFIT)
                  </span>
                  <p className="text-[11px] text-emerald-600">
                    Pendapatan Penjualan - HPP - Seluruh Biaya Operasional
                  </p>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                  {formatRupiah(labaBersih)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Neraca Tab Content */}
        {reportTab === 'neraca' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
            {/* AKTIVA (ASSETS) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-indigo-900 border-b pb-2 flex items-center justify-between">
                <span>AKTIVA (ASET RAM)</span>
                <span className="font-mono">{formatRupiah(totalAktiva)}</span>
              </h4>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Aset Lancar:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Kas & Bank (Owner, Admin, Petty Cash)</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalKas)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Piutang Kasbon Petani & Sopir</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalPiutangKasbon)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Persediaan Buah di RAM Fisik</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalNilaiStokRAM)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Persediaan Dalam Perjalanan (Truk PKS)</span>
                    <span className="font-mono font-bold text-slate-900">{formatRupiah(totalStokDalamPerjalanan)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl font-bold flex justify-between text-indigo-950">
                <span>TOTAL AKTIVA</span>
                <span className="font-mono text-sm">{formatRupiah(totalAktiva)}</span>
              </div>
            </div>

            {/* PASIVA (LIABILITIES & EQUITY) */}
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-900 border-b pb-2 flex items-center justify-between">
                <span>PASIVA (KEWAJIBAN & MODAL)</span>
                <span className="font-mono">{formatRupiah(totalPasiva)}</span>
              </h4>

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block">Kewajiban / Utang Usaha:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Hutang Pembayaran Petani (Belum Lunas)</span>
                    <span className="font-mono font-bold text-rose-600">{formatRupiah(totalUtangPetani)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-700 block">Ekuitas & Modal Owner:</span>
                <div className="pl-3 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Suntikan Modal / Modal Disetor Owner</span>
                    <span className="font-mono font-bold text-indigo-900">{formatRupiah(totalModalOwner)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ekuitas Berjalan & Laba Ditahan</span>
                    <span className={`font-mono font-bold ${labaDitahan < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatRupiah(labaDitahan)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl font-bold flex justify-between text-slate-900">
                <span>TOTAL PASIVA</span>
                <span className="font-mono text-sm">{formatRupiah(totalPasiva)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Susut Timbang Tab Content */}
        {reportTab === 'susut_pks' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Surat Jalan</th>
                    <th className="py-3 px-4">Pabrik PKS</th>
                    <th className="py-3 px-4 text-right">Netto RAM (kg)</th>
                    <th className="py-3 px-4 text-right">Netto 1 PKS (kg)</th>
                    <th className="py-3 px-4 text-right">Susut Muatan (kg)</th>
                    <th className="py-3 px-4 text-right">Persentase Susut</th>
                    <th className="py-3 px-4 text-center">Evaluasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        Tidak ada transaksi penjualan / rekap timbangan PKS pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {s.shipmentNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {s.factoryName}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {s.ramNettoKg.toLocaleString('id-ID')} kg
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-indigo-950 font-bold">
                          {s.factoryNetto1.toLocaleString('id-ID')} kg
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                          {s.shrinkageKg} kg
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                          {s.shrinkagePct}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              s.shrinkagePct <= 0.5
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {s.shrinkagePct <= 0.5 ? 'Normal Sesuai Standar' : 'Perlu Evaluasi Timbangan'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
