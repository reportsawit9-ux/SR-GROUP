import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Lock,
  Layers,
  Fuel,
  Wrench,
  Receipt,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Coins,
  Trash2,
} from 'lucide-react';
import { CashAccount, CashTransaction, CashReconciliationReport, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface CashSectionProps {
  currentUser: UserProfile;
}

export const CashSection: React.FC<CashSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Reconciliation & Status
  const [reconciliation, setReconciliation] = useState<CashReconciliationReport | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileFeedback, setReconcileFeedback] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Capital Form Fields (Modal Awal Owner)
  const [capitalAmount, setCapitalAmount] = useState<number | ''>(10000000);
  const [capitalNotes, setCapitalNotes] = useState('Setoran modal awal kerja Kas Owner');

  // Expense Form Fields
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseCategory, setExpenseCategory] = useState('BBM & Solar Genset');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState<'KAS_ADMIN' | 'KAS_OWNER'>('KAS_ADMIN');

  // Transfer Form Fields
  const [transferFrom, setTransferFrom] = useState<'KAS_OWNER' | 'KAS_ADMIN'>('KAS_OWNER');
  const [transferTo, setTransferTo] = useState<'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'>('KAS_ADMIN');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');

  const refreshData = async () => {
    try {
      const rep = await storage.reconcileCashBalances();
      setReconciliation(rep);

      let accs = await storage.getCashAccounts();
      if (!isOwner && !accs.some(a => a.id === 'KAS_ADMIN')) {
        const adminAcc = await storage.getCashAccountById('KAS_ADMIN');
        if (adminAcc) accs = [...accs, adminAcc];
      }
      const txs = await storage.getCashTransactions();
      setAccounts(accs);
      setTransactions(txs);
    } catch (err) {
      console.error('Error refreshing cash data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser.id, currentUser.role]);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  // Filter visible accounts based on role:
  // Admin sees KAS_ADMIN! Owner sees all.
  const visibleAccounts = accounts.filter((acc) => {
    if (isOwner) return true;
    if (acc.id === 'KAS_ADMIN') return true;
    return Array.isArray(acc.roleRestricted) && acc.roleRestricted.includes(currentUser.role);
  });

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = Number(expenseAmount) || 0;
    if (amount <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: expenseDate,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'PENGELUARAN_OPERASIONAL',
        category: expenseCategory,
        accountId: isOwner ? expenseAccountId : 'KAS_ADMIN',
        direction: 'OUT',
        amount,
        description: expenseDescription || expenseCategory,
      });

      await refreshData();
      setIsExpenseModalOpen(false);
      setExpenseAmount('');
      setExpenseDescription('');
      alert('Pengeluaran operasional berhasil dicatat!');
    } catch (err) {
      console.error('Error recording expense:', err);
      alert('Gagal mencatat pengeluaran, silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = Number(transferAmount) || 0;
    if (amount <= 0) {
      alert('Nominal transfer harus lebih besar dari Rp 0!');
      return;
    }

    if (transferFrom === transferTo) {
      alert('Akun asal dan akun tujuan tidak boleh sama!');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === transferFrom);
    if (fromAcc && fromAcc.balance < amount) {
      alert(`Saldo ${fromAcc.name} tidak mencukupi (Rp ${fromAcc.balance.toLocaleString('id-ID')})!`);
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.transferCash(transferFrom, transferTo, amount, transferNotes);
      await refreshData();
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferNotes('');
      alert('Transfer saldo kas antarakun berhasil dijalankan!');
    } catch (err) {
      console.error('Error executing transfer:', err);
      alert('Gagal menjalankan transfer, silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCapitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = Number(capitalAmount) || 0;
    if (amount <= 0) {
      alert('Nominal modal harus lebih besar dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.addLoan({
        partyName: 'H. Rahmat (Owner)',
        type: 'MODAL_OWNER',
        principalAmount: amount,
        remainingAmount: amount,
        date: new Date().toISOString().slice(0, 10),
        status: 'AKTIF',
        notes: capitalNotes || 'Setoran modal kerja awal owner',
      });

      await refreshData();
      setIsCapitalModalOpen(false);
      setCapitalNotes('Setoran modal kerja kas owner');
      setReconcileFeedback(`Modal awal sebesar ${formatRupiah(amount)} berhasil masuk ke Kas Utama Owner & divalidasi 100%.`);
      setTimeout(() => setReconcileFeedback(null), 5000);
    } catch (err) {
      console.error('Error submitting capital:', err);
      alert('Gagal menyetor modal awal, silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualReconcile = async () => {
    setIsReconciling(true);
    setReconcileFeedback(null);
    try {
      const rep = await storage.reconcileCashBalances();
      setReconciliation(rep);
      await refreshData();
      setReconcileFeedback(`Validasi Selesai: Seluruh saldo akun (${rep.transactionCount} transaksi) terhitung ulang & sinkron 100% dengan database.`);
      setTimeout(() => setReconcileFeedback(null), 4000);
    } catch (err) {
      console.error('Error reconciling:', err);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleResetTrialData = async () => {
    setIsReconciling(true);
    try {
      await storage.clearAllTrialData();
      await refreshData();
      setIsResetConfirmOpen(false);
      setReconcileFeedback('Seluruh data transaksi trial berhasil dikosongkan. Saldo kas kembali ke Rp 0 untuk trial dari awal.');
      setTimeout(() => setReconcileFeedback(null), 6000);
    } catch (err) {
      console.error('Error resetting trial data:', err);
    } finally {
      setIsReconciling(false);
    }
  };

  // Filter transactions visible to user
  const visibleTransactions = transactions.filter((tx) => {
    // If Admin, only show transactions concerning KAS_ADMIN
    if (!isOwner && tx.accountId !== 'KAS_ADMIN' && tx.targetAccountId !== 'KAS_ADMIN') {
      return false;
    }

    const matchAccount =
      selectedAccountFilter === 'ALL' ||
      tx.accountId === selectedAccountFilter ||
      tx.targetAccountId === selectedAccountFilter;

    const matchDirection =
      directionFilter === 'ALL' || tx.direction === directionFilter;

    const matchSearch =
      tx.transactionNumber.toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase()) ||
      tx.description.toLowerCase().includes(search.toLowerCase());

    return matchAccount && matchDirection && matchSearch;
  });

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-600" />
            Manajemen Saldo Kas & Pengeluaran RAM
          </h2>
          <p className="text-xs text-slate-500">
            {isOwner
              ? 'Monitoring Kas Owner, Kas Admin, Petty Cash, dan mutasi arus kas'
              : 'Monitoring saldo Kas Operasional Admin dan pengeluaran harian pos timbangan'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <button
              onClick={() => setIsCapitalModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
              title="Setor modal awal Kas Owner"
            >
              <Coins className="w-3.5 h-3.5" />
              Setor Modal Awal
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 flex items-center gap-1.5 transition-all"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              Transfer Antarkas
            </button>
          )}

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat Biaya
          </button>

          {isOwner && (
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 flex items-center gap-1.5 transition-all"
              title="Kosongkan semua data input transaksi untuk trial dari awal"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Mulai Trial Nol
            </button>
          )}
        </div>
      </div>

      {/* Automatic Cash Balances Validation Card */}
      <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-slate-50 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                Validasi Otomatis Saldo Kas: 100% Sinkron Database
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Audit Terakhir: {reconciliation?.lastChecked || 'Baru saja'}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Saldo akun dihitung ulang secara matematis dari seluruh riwayat mutasi kas masuk (debit), kas keluar (kredit), dan transfer antarkas sehingga selalu akurat tanpa selisih.
            </p>

            {/* Metrics Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 font-medium text-slate-700 shadow-2xs">
                Total Mutasi: <strong className="font-mono text-slate-900">{reconciliation?.transactionCount ?? transactions.length}</strong>
              </div>
              <div className="px-2.5 py-1 bg-white rounded-lg border border-emerald-200 font-medium text-emerald-800 shadow-2xs">
                Total Kas Masuk (+): <strong className="font-mono text-emerald-700">{formatRupiah(reconciliation?.totalIn ?? 0)}</strong>
              </div>
              <div className="px-2.5 py-1 bg-white rounded-lg border border-rose-200 font-medium text-rose-800 shadow-2xs">
                Total Kas Keluar (-): <strong className="font-mono text-rose-700">{formatRupiah(reconciliation?.totalOut ?? 0)}</strong>
              </div>
              <div className="px-2.5 py-1 bg-white rounded-lg border border-indigo-200 font-medium text-indigo-800 shadow-2xs">
                Saldo Netto Riil: <strong className="font-mono text-indigo-700">{formatRupiah((reconciliation?.totalIn ?? 0) - (reconciliation?.totalOut ?? 0))}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
            <button
              onClick={handleManualReconcile}
              disabled={isReconciling}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isReconciling ? 'animate-spin' : ''}`} />
              {isReconciling ? 'Menghitung Ulang...' : 'Validasi & Hitung Ulang Saldo'}
            </button>
          </div>
        </div>

        {reconcileFeedback && (
          <div className="mt-2.5 p-2 bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs rounded-xl flex items-center gap-2 animate-in fade-in duration-200 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{reconcileFeedback}</span>
          </div>
        )}

        {reconciliation && reconciliation.discrepancies.length > 0 && (
          <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Penyesuaian Saldo Otomatis Berhasil:</p>
              <ul className="list-disc list-inside mt-0.5 text-[11px] space-y-0.5">
                {reconciliation.discrepancies.map((d) => (
                  <li key={d.accountId}>
                    Akun {d.accountId}: Saldo lama {formatRupiah(d.storedBalance)} telah disinkronkan menjadi {formatRupiah(d.calculatedBalance)} sesuai riwayat transaksi nyata.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {visibleAccounts.map((acc) => {
          const isMainOwner = acc.id === 'KAS_OWNER';
          const isPetty = acc.id === 'PETTY_CASH';

          return (
            <div
              key={acc.id}
              className={`p-4 sm:p-5 rounded-3xl border shadow-xs transition-all relative overflow-hidden ${
                isMainOwner
                  ? 'bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white border-indigo-800'
                  : 'bg-white border-slate-200/90 text-slate-900'
              }`}
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                    isMainOwner
                      ? 'bg-white/10 text-indigo-200 border border-white/15'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {acc.id}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isMainOwner
                      ? 'bg-white/10 text-white'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                <span
                  className={`text-xs font-semibold ${
                    isMainOwner ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  {acc.name}
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1">
                  {formatRupiah(acc.balance)}
                </div>
              </div>

              <p
                className={`text-[11px] mt-3 pt-2.5 border-t ${
                  isMainOwner
                    ? 'border-white/10 text-slate-300'
                    : 'border-slate-100 text-slate-400'
                }`}
              >
                {acc.description}
              </p>
            </div>
          );
        })}

        {/* Informative placeholder if user is Admin and can't see Owner cash */}
        {!isOwner && (
          <div className="p-4 sm:p-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col justify-center items-center text-center">
            <div className="w-9 h-9 rounded-2xl bg-slate-200 text-slate-400 flex items-center justify-center mb-1.5">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-slate-700">Kas Utama Owner Terproteksi</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              Sesuai hak akses Admin, Kas Utama Owner dan Petty Cash Keuntungan hanya dapat dilihat oleh Owner.
            </p>
          </div>
        )}
      </div>

      {/* Transaction Filter & History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi kas, kategori, keterangan..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="ALL">Semua Arah Arus</option>
              <option value="IN">Masuk (Penerimaan)</option>
              <option value="OUT">Keluar (Pengeluaran)</option>
            </select>

            {isOwner && (
              <select
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
              >
                <option value="ALL">Semua Akun Kas</option>
                <option value="KAS_ADMIN">Kas Admin</option>
                <option value="KAS_OWNER">Kas Owner</option>
                <option value="PETTY_CASH">Petty Cash</option>
              </select>
            )}
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">Bukti / Waktu</th>
                <th className="py-2 px-2">Kategori / Keterangan</th>
                <th className="py-2 px-2">Akun</th>
                <th className="py-2 px-2">Pihak</th>
                <th className="py-2 px-2 text-right">Nominal (Rp)</th>
                <th className="py-2 px-2 text-right">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono font-bold text-slate-900">{tx.transactionNumber}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{tx.date} {tx.time}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-slate-800">{tx.category}</span>
                      <span className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[200px]">{tx.description}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2">
                    <span className="px-1 py-0.5 rounded-[4px] font-black uppercase text-[8px] bg-slate-100 text-slate-600 border border-slate-200">
                      {tx.accountId.replace('KAS_', '')}
                    </span>
                    {tx.targetAccountId && (
                      <span className="text-slate-400 mx-1">➔ {tx.targetAccountId.replace('KAS_', '')}</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600 truncate max-w-[100px]">
                    {tx.partyName || '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-black text-[11px] whitespace-nowrap">
                    <span className={tx.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                      {tx.direction === 'IN' ? '+' : '-'}{Math.round(tx.amount).toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-slate-400 opacity-70 italic">
                    {tx.createdByName.split(' ')[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleExpenseSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                Catat Pengeluaran Operasional
              </h3>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Biaya
              </label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="BBM & Solar Genset">BBM & Solar Genset Timbangan</option>
                <option value="Upah & Gaji Karyawan">Upah & Gaji Karyawan Lapangan</option>
                <option value="Makan & Konsumsi Pekerja">Makan & Konsumsi Harian</option>
                <option value="Perawatan & Kalibrasi Timbangan">Perawatan & Tera Timbangan</option>
                <option value="Listrik, Pulsa & ATK">Listrik, Pulsa & Kertas Struk ATK</option>
                <option value="Biaya Lain-Lain">Biaya Operasional Lain-Lain</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sumber Kas Pembayaran
              </label>
              <select
                value={expenseAccountId}
                onChange={(e) =>
                  setExpenseAccountId(e.target.value as 'KAS_ADMIN' | 'KAS_OWNER')
                }
                disabled={!isOwner}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              >
                <option value="KAS_ADMIN">Kas Operasional Admin (Brankas RAM)</option>
                {isOwner && <option value="KAS_OWNER">Kas Utama Owner</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Pengeluaran (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={expenseAmount}
                onChange={(e) =>
                  setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-rose-600 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan Lengkap
              </label>
              <input
                type="text"
                placeholder="Contoh: Beli 25 liter solar untuk genset sore"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Simpan Pengeluaran</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal (Owner Only) */}
      {isTransferModalOpen && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleTransferSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                Transfer Antarkas RAM
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Dari Akun Asal
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) =>
                    setTransferFrom(e.target.value as 'KAS_OWNER' | 'KAS_ADMIN')
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="KAS_OWNER">Kas Owner</option>
                  <option value="KAS_ADMIN">Kas Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ke Akun Tujuan
                </label>
                <select
                  value={transferTo}
                  onChange={(e) =>
                    setTransferTo(
                      e.target.value as 'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'
                    )
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="KAS_ADMIN">Kas Admin (Operasional)</option>
                  <option value="PETTY_CASH">Petty Cash Keuntungan</option>
                  <option value="KAS_OWNER">Kas Owner</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Transfer (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={transferAmount}
                onChange={(e) =>
                  setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-indigo-900 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Alasan Transfer
              </label>
              <input
                type="text"
                placeholder="Contoh: Drop dana kas operasional pos timbang harian"
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Jalankan Transfer</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Capital Inflow Modal (Owner Only) */}
      {isCapitalModalOpen && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCapitalSubmit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600" />
                Setoran Modal Awal Kerja (Kas Owner)
              </h3>
              <button
                type="button"
                onClick={() => setIsCapitalModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
              Setoran modal awal akan langsung menambah saldo <strong>Kas Utama Owner (Bank Mandiri / Tunai)</strong> dan tercatat sebagai mutasi modal masuk yang tervalidasi 100%.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Modal Awal (Rp)
              </label>
              <input
                type="number"
                placeholder="Contoh: 10000000"
                value={capitalAmount}
                onChange={(e) =>
                  setCapitalAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-base font-mono font-black text-emerald-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {capitalAmount ? formatRupiah(Number(capitalAmount)) : 'Rp 0'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Keterangan
              </label>
              <input
                type="text"
                placeholder="Contoh: Suntikan modal kerja trial awal RAM Sumber Rezeki"
                value={capitalNotes}
                onChange={(e) => setCapitalNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCapitalModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Setor Modal Sekarang</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Trial Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Kosongkan Data Trial (Mulai dari Nol)?
                </h3>
                <p className="text-xs text-slate-500">
                  RAM Sumber Rezeki - Reset Bersih
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5">
              <p className="font-bold">Tindakan ini akan mengosongkan:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5">
                <li>Seluruh riwayat mutasi kas & pengeluaran</li>
                <li>Seluruh tiket timbangan petani</li>
                <li>Seluruh surat jalan pengiriman PKS</li>
                <li>Seluruh penjualan & pelunasan pabrik</li>
                <li>Seluruh data kasbon & pinjaman modal</li>
                <li>Saldo Kas Owner, Kas Admin, Petty Cash kembali ke <strong>Rp 0</strong></li>
              </ul>
              <p className="text-[11px] font-semibold pt-1">
                Data master kontak (petani, pabrik, sopir) dan jenis produk tetap aman tersimpan.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleResetTrialData}
                disabled={isReconciling}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isReconciling ? 'Mengosongkan...' : 'Ya, Kosongkan & Mulai Nol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
