import React, { useState, useEffect } from 'react';
import {
  HandCoins,
  Plus,
  Search,
  CheckCircle,
  Clock,
  User,
  ShieldCheck,
  CreditCard,
  ArrowDownLeft,
  Trash2,
} from 'lucide-react';
import { LoanDebt, UserProfile, Party } from '../types';
import { storage } from '../lib/storage';

interface LoansDebtsSectionProps {
  currentUser: UserProfile;
}

export const LoansDebtsSection: React.FC<LoansDebtsSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [loans, setLoans] = useState<LoanDebt[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activeLoan, setActiveLoan] = useState<LoanDebt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form New Loan
  const [newLoanType, setNewLoanType] = useState<'MODAL_OWNER' | 'KASBON_PETANI' | 'KASBON_KARYAWAN'>('KASBON_PETANI');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [principalAmount, setPrincipalAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Form Payment
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payNotes, setPayNotes] = useState('');

  const refreshData = async () => {
    try {
      const [ln, pt] = await Promise.all([storage.getLoans(), storage.getParties()]);
      setLoans(ln);
      setParties(pt);
    } catch (e) {
      console.error('Error fetching loans data:', e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handleOpenPay = (loan: LoanDebt) => {
    setActiveLoan(loan);
    setPayAmount(loan.remainingAmount);
    setPayNotes('');
    setIsPayModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const amount = Number(principalAmount) || 0;
    if (amount <= 0) {
      alert('Nominal harus lebih besar dari Rp 0!');
      return;
    }

    let finalName = partyName;
    if (newLoanType === 'MODAL_OWNER') {
      finalName = 'H. Rahmat (Owner)';
    } else if (selectedPartyId) {
      const p = parties.find((party) => party.id === selectedPartyId);
      if (p) finalName = p.name;
    }

    if (!finalName) {
      alert('Silakan pilih atau ketik nama pihak bersangkutan!');
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.addLoan({
        partyId: selectedPartyId || undefined,
        partyName: finalName,
        type: newLoanType,
        principalAmount: amount,
        remainingAmount: amount,
        date: new Date().toISOString().slice(0, 10),
        status: 'AKTIF',
        notes,
      });

      await refreshData();
      setIsAddModalOpen(false);
      setPrincipalAmount('');
      setPartyName('');
      setNotes('');
      alert('Pencatatan pinjaman/kasbon berhasil dibuat!');
    } catch (err) {
      console.error('Error adding loan:', err);
      alert('Gagal membuat pencatatan, silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan || isSubmitting) return;

    const amount = Number(payAmount) || 0;
    if (amount <= 0 || amount > activeLoan.remainingAmount) {
      alert(`Nominal pembayaran tidak valid! Maksimal: Rp ${activeLoan.remainingAmount.toLocaleString('id-ID')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.recordLoanPayment(activeLoan.id, amount, payNotes);
      await refreshData();
      setIsPayModalOpen(false);
      setActiveLoan(null);
      alert('Pembayaran angsuran berhasil dicatat!');
    } catch (err) {
      console.error('Error recording loan payment:', err);
      alert('Gagal mencatat pembayaran angsuran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLoan = async (loan: LoanDebt) => {
    const confirmText = `Apakah Anda yakin ingin MENGHAPUS catatan ini?\n\n• Nama: ${loan.partyName}\n• Jenis: ${loan.type.replace('_', ' ')}\n• Nominal: Rp ${loan.principalAmount.toLocaleString('id-ID')}\n• Sisa Saldo: Rp ${loan.remainingAmount.toLocaleString('id-ID')}`;
    
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      await storage.deleteLoan(loan.id);
      await refreshData();
      alert('Catatan pinjaman/kasbon berhasil dihapus!');
    } catch (e) {
      console.error('Error deleting loan:', e);
      alert('Gagal menghapus catatan. Silakan coba lagi.');
    }
  };

  const filteredLoans = loans.filter((l) => {
    // If Admin, they cannot see MODAL_OWNER
    if (!isOwner && l.type === 'MODAL_OWNER') return false;

    const matchType = typeFilter === 'ALL' || l.type === typeFilter;
    const matchSearch =
      l.partyName.toLowerCase().includes(search.toLowerCase()) ||
      (l.notes && l.notes.toLowerCase().includes(search.toLowerCase()));

    return matchType && matchSearch;
  });

  const totalOutstandingPiutang = loans
    .filter((l) => l.type !== 'MODAL_OWNER' && l.status === 'AKTIF')
    .reduce((acc, l) => acc + l.remainingAmount, 0);

  const totalModalOwner = loans
    .filter((l) => l.type === 'MODAL_OWNER' && l.status === 'AKTIF')
    .reduce((acc, l) => acc + l.remainingAmount, 0);

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-indigo-600" />
            Utang Modal & Piutang Kasbon Petani / Karyawan
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan pinjaman, kasbon pupuk, dan pembayaran angsuran berkala
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          + Catat Kasbon / Pinjaman
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">
            Total Piutang Kasbon Petani & Pekerja
          </span>
          <div className="text-2xl font-black text-rose-600 font-mono mt-1">
            {formatRupiah(totalOutstandingPiutang)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Hak tagih RAM Sumber Rezeki (Aset Lancar)
          </p>
        </div>

        {isOwner && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">
              Sisa Pinjaman Modal Owner ke RAM
            </span>
            <div className="text-2xl font-black text-indigo-900 font-mono mt-1">
              {formatRupiah(totalModalOwner)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Kewajiban RAM kepada Owner (Bukan beban operasional)
            </p>
          </div>
        )}

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">
            Jumlah Debitur Aktif
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {filteredLoans.filter((l) => l.status === 'AKTIF').length} Orang
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2">
            Angsuran dipotong dari nota timbang buah
          </p>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama debitur, petani, catatan..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              <option value="ALL">Semua Jenis</option>
              <option value="KASBON_PETANI">Kasbon Petani</option>
              <option value="KASBON_KARYAWAN">Kasbon Karyawan</option>
              {isOwner && <option value="MODAL_OWNER">Pinjaman Modal Owner</option>}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-3 whitespace-nowrap">Tanggal / Debitur</th>
                <th className="py-2 px-3">Jenis Kewajiban</th>
                <th className="py-2 px-3 text-right">Pokok Awal</th>
                <th className="py-2 px-3 text-right">Sisa Saldo</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3">Keterangan</th>
                <th className="py-2 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-slate-800">{l.partyName}</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">{l.date}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0 rounded uppercase ${
                        l.type === 'MODAL_OWNER'
                          ? 'bg-indigo-100 text-indigo-800'
                          : l.type === 'KASBON_PETANI'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {l.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                    {l.principalAmount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                    {l.remainingAmount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0 rounded uppercase ${
                        l.status === 'LUNAS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-slate-500 max-w-[150px] truncate text-[9px] leading-tight">
                    {l.notes || '-'}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {l.remainingAmount > 0 ? (
                        <button
                          onClick={() => handleOpenPay(l)}
                          title="Bayar Angsuran / Pelunasan"
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>Bayar</span>
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-black text-[9px] mr-1">LUNAS</span>
                      )}
                      <button
                        onClick={() => handleDeleteLoan(l)}
                        title="Hapus Catatan Ini"
                        className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[10px] transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Trash2 className="w-3 h-3 text-rose-600" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Loan Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveLoan}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-indigo-600" />
                Catat Pinjaman / Kasbon Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jenis Pinjaman
              </label>
              <select
                value={newLoanType}
                onChange={(e) =>
                  setNewLoanType(
                    e.target.value as 'MODAL_OWNER' | 'KASBON_PETANI' | 'KASBON_KARYAWAN'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="KASBON_PETANI">Kasbon Petani (Potong Kas Admin)</option>
                <option value="KASBON_KARYAWAN">Kasbon Pekerja / Sopir (Kas Admin)</option>
                {isOwner && (
                  <option value="MODAL_OWNER">Suntikan Modal Owner (Kas Owner)</option>
                )}
              </select>
            </div>

            {newLoanType !== 'MODAL_OWNER' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Petani / Pihak
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => {
                    setSelectedPartyId(e.target.value);
                    const p = parties.find((item) => item.id === e.target.value);
                    if (p) setPartyName(p.name);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">-- Pilih dari Kontak Terdaftar --</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Atau ketik nama manual..."
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl mt-1.5"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Pinjaman / Kasbon (Rp)
              </label>
              <input
                type="number"
                placeholder="0"
                value={principalAmount}
                onChange={(e) =>
                  setPrincipalAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-rose-600 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Keperluan
              </label>
              <input
                type="text"
                placeholder="Contoh: Pembelian pupuk NPK 5 karung"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
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
                  <span>Simpan & Cairkan</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Loan Modal */}
      {isPayModalOpen && activeLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSavePayment}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                Bayar Angsuran / Pelunasan
              </h3>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Debitur:</span>
                <span className="font-bold text-slate-900">{activeLoan.partyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sisa Saldo Kasbon:</span>
                <span className="font-mono font-black text-rose-600">
                  {formatRupiah(activeLoan.remainingAmount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Angsuran Dibayar (Rp)
              </label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) =>
                  setPayAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                max={activeLoan.remainingAmount}
                className="w-full px-3 py-2 text-sm font-mono font-black text-emerald-800 border-2 border-emerald-300 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan Setoran
              </label>
              <input
                type="text"
                placeholder="Contoh: Potong nota timbang / setor tunai kas"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
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
                  <span>Proses Pembayaran</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
