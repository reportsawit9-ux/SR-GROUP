import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, CheckCircle, Clock, Printer, User, DollarSign, FileText, Trash2 } from 'lucide-react';
import { WeighingTicket, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface PurchasesSectionProps {
  currentUser: UserProfile;
  onOpenPrint: (ticket: WeighingTicket) => void;
}

export const PurchasesSection: React.FC<PurchasesSectionProps> = ({
  currentUser,
  onOpenPrint,
}) => {
  const [tickets, setTickets] = useState<WeighingTicket[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [editingTicket, setEditingTicket] = useState<WeighingTicket | null>(null);

  useEffect(() => {
    storage.getTickets().then(setTickets);
  }, []);

  // Edit form state
  const [editFarmerName, setEditFarmerName] = useState('');
  const [editVehiclePlate, setEditEditVehiclePlate] = useState('');
  const [editPricePerKg, setEditPricePerKg] = useState<number>(0);
  const [editUnloadingFee, setEditUnloadingFee] = useState<number>(0);
  const [editRafaksiPct, setEditRafaksiPct] = useState<number>(0);
  const [editNotes, setEditNotes] = useState('');

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handleEdit = (ticket: WeighingTicket) => {
    setEditingTicket(ticket);
    setEditFarmerName(ticket.farmerName);
    setEditEditVehiclePlate(ticket.vehiclePlate);
    setEditPricePerKg(ticket.pricePerKg);
    setEditUnloadingFee(ticket.unloadingFeePerKg);
    setEditRafaksiPct(ticket.rafaksiPct);
    setEditNotes(ticket.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    // Recalculate values based on edits
    const netto1 = editingTicket.netto1;
    const rafaksiKg = Math.round(netto1 * (editRafaksiPct / 100));
    const netto2 = Math.max(0, netto1 - rafaksiKg);
    const baseAmount = netto2 * editPricePerKg;
    const totalUnloadingFee = netto2 * editUnloadingFee;
    const farmerPayment = Math.max(0, baseAmount - totalUnloadingFee);

    const totalAffiliateFee = editingTicket.affiliateFeePerKg 
      ? netto2 * editingTicket.affiliateFeePerKg 
      : undefined;

    await storage.updateWeighingTicket(editingTicket.id, {
      farmerName: editFarmerName,
      vehiclePlate: editVehiclePlate.toUpperCase(),
      pricePerKg: editPricePerKg,
      unloadingFeePerKg: editUnloadingFee,
      rafaksiPct: editRafaksiPct,
      rafaksiKg,
      netto2,
      baseAmount,
      totalUnloadingFee,
      farmerPayment,
      totalAffiliateFee,
      notes: editNotes,
    });

    const updated = await storage.getTickets();
    setTickets(updated);
    setEditingTicket(null);
    alert('Data pembelian berhasil diperbarui!');
  };

  const handleMarkAsPaid = async (ticketId: string) => {
    await storage.updateWeighingTicket(ticketId, {
      paymentStatus: 'LUNAS',
      paidAt: new Date().toISOString(),
    });

    const updated = await storage.getTickets();
    setTickets(updated);
    alert(`Pembayaran berhasil diproses dan dicatat di Kas Admin.`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Hapus data pembelian an. ${name}? Saldo kas akan dikoreksi otomatis.`)) {
      await storage.deleteWeighingTicket(id);
      const updated = await storage.getTickets();
      setTickets(updated);
    }
  };

  const filtered = tickets.filter((t) => {
    const matchSearch =
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.farmerName.toLowerCase().includes(search.toLowerCase()) ||
      t.vehiclePlate.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || t.paymentStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalAllPurchases = filtered.reduce((acc, t) => acc + t.farmerPayment, 0);
  const totalAllAffiliate = filtered.reduce((acc, t) => acc + (t.totalAffiliateFee || 0), 0);
  const totalNetto1Kg = filtered.reduce((acc, t) => acc + t.netto1, 0);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-indigo-600" />
            Rekap Pembelian TBS & Alokasi Komisi Affiliate
          </h2>
          <p className="text-xs text-slate-500">
            Pemisahan alokasi pembayaran petani dan komisi rombongan/affiliate
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
          >
            <option value="ALL">Semua Status Bayar</option>
            <option value="LUNAS">Sudah Lunas</option>
            <option value="BELUM_LUNAS">Belum Lunas (Utang Petani)</option>
          </select>
        </div>
      </div>

      {/* KPI Cards for Purchases */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">
            Total Pembelian Bersih Petani
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {formatRupiah(totalAllPurchases)}
          </div>
          <span className="text-[11px] text-slate-400">
            {totalNetto1Kg.toLocaleString('id-ID')} kg sawit
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">
            Total Komisi Rombongan / Affiliate
          </span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
            {formatRupiah(totalAllAffiliate)}
          </div>
          <span className="text-[11px] text-slate-400">
            Dialokasikan terpisah dari petani
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500">
            Total Pengeluaran Buah + Komisi
          </span>
          <div className="text-xl sm:text-2xl font-black text-indigo-900 mt-1">
            {formatRupiah(totalAllPurchases + totalAllAffiliate)}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">
            Beban Kas Operasional Admin
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari transaksi pembelian..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filtered.length} Transaksi
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">Tiket / Petani</th>
                <th className="py-2 px-2 text-right">Net1</th>
                <th className="py-2 px-2 text-right font-black">Net2</th>
                <th className="py-2 px-2 text-right">Nilai Beli</th>
                <th className="py-2 px-2 text-right">Bongkar</th>
                <th className="py-2 px-2 text-right font-black">Bayar Petani</th>
                <th className="py-2 px-2 text-right">Komisi Affiliate</th>
                <th className="py-2 px-2 text-center">Status</th>
                <th className="py-2 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono font-bold text-slate-900">{t.ticketNumber}</span>
                      <div className="text-[9px] mt-0.5">
                        <span className="font-bold text-slate-800">{t.farmerName}</span>
                        <span className="text-slate-400 ml-1 opacity-70">({t.date})</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                    {t.netto1.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-bold text-indigo-900">
                    {t.netto2.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                    {Math.round(t.baseAmount).toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-rose-600">
                    -{Math.round(t.totalUnloadingFee).toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-black text-emerald-700 bg-emerald-50/20">
                    {Math.round(t.farmerPayment).toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-amber-700">
                    {t.totalAffiliateFee && t.totalAffiliateFee > 0
                      ? `${Math.round(t.totalAffiliateFee).toLocaleString('id-ID')} [${t.affiliateName?.split(' ')[0]}]`
                      : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded-[4px] font-black uppercase text-[8px] ${
                      t.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {t.paymentStatus}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {t.paymentStatus === 'BELUM_LUNAS' && (
                        <button
                          onClick={() => handleMarkAsPaid(t.id)}
                          className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black hover:bg-emerald-700"
                        >
                          BAYAR
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(t)}
                        className="p-1 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onOpenPrint(t)}
                        className="p-1 rounded text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.farmerName)}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 border border-rose-100"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Data Pembelian: {editingTicket.ticketNumber}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Nama Petani</label>
                <input
                  type="text"
                  value={editFarmerName}
                  onChange={(e) => setEditFarmerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">No. Polisi</label>
                <input
                  type="text"
                  value={editVehiclePlate}
                  onChange={(e) => setEditEditVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs border rounded-xl uppercase font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Harga (Rp/kg)</label>
                <input
                  type="number"
                  value={editPricePerKg}
                  onChange={(e) => setEditPricePerKg(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs border rounded-xl font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Bongkar (Rp/kg)</label>
                <input
                  type="number"
                  value={editUnloadingFee}
                  onChange={(e) => setEditUnloadingFee(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs border rounded-xl font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Rafaksi (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editRafaksiPct}
                  onChange={(e) => setEditRafaksiPct(Number(e.target.value))}
                  className="w-full px-2 py-2 text-xs border rounded-xl font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Catatan</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingTicket(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

