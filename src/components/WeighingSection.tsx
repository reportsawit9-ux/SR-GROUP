import React, { useState, useEffect } from 'react';
import {
  Scale,
  Plus,
  Printer,
  Search,
  CheckCircle,
  AlertCircle,
  FileText,
  UserPlus,
  ChevronDown,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { WeighingTicket, ProductTypeId, UserProfile, Party } from '../types';
import { storage } from '../lib/storage';

interface WeighingSectionProps {
  currentUser: UserProfile;
  onOpenPrint: (ticket: WeighingTicket) => void;
  externalSearch?: string;
}

export const WeighingSection: React.FC<WeighingSectionProps> = ({
  currentUser,
  onOpenPrint,
  externalSearch = '',
}) => {
  const [tickets, setTickets] = useState<WeighingTicket[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    defaultRafaksiPct: 3.0,
    defaultUnloadingFeePerKg: 15
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<WeighingTicket | null>(null);
  const [search, setSearch] = useState(externalSearch);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('ALL');

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [customFarmerName, setCustomFarmerName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [productId, setProductId] = useState<ProductTypeId>('TBS');

  // Numerical inputs
  const [bruto, setBruto] = useState<number | ''>('');
  const [tara, setTara] = useState<number | ''>('');
  const [rafaksiPct, setRafaksiPct] = useState<number>(3.0);
  const [pricePerKg, setPricePerKg] = useState<number>(2650);
  const [unloadingFeePerKg, setUnloadingFeePerKg] = useState<number>(15);

  // Affiliate
  const [hasAffiliate, setHasAffiliate] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [affiliateFeePerKg, setAffiliateFeePerKg] = useState<number>(20);

  // Payment
  const [paymentStatus, setPaymentStatus] = useState<'LUNAS' | 'BELUM_LUNAS'>('LUNAS');
  const [notes, setNotes] = useState('');

  const refreshData = async () => {
    try {
      const [t, p, pr, s] = await Promise.all([
        storage.getTickets(),
        storage.getParties(),
        storage.getProducts(),
        storage.getSettings()
      ]);
      setTickets(t);
      setParties(p);
      setProducts(pr);
      setSettings(s);
      
      if (!editingTicket) {
        setRafaksiPct(s.defaultRafaksiPct);
        setUnloadingFeePerKg(s.defaultUnloadingFeePerKg);
      }
    } catch (err) {
      console.error('Error refreshing weighing data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (externalSearch) {
      setSearch(externalSearch);
    }
  }, [externalSearch]);

  const handleEdit = (ticket: WeighingTicket) => {
    setEditingTicket(ticket);
    setIsFormOpen(true);
    
    setDate(ticket.date);
    setTime(ticket.time);
    setSelectedPartyId(ticket.partyId);
    setCustomFarmerName(ticket.farmerName);
    setVehiclePlate(ticket.vehiclePlate);
    setProductId(ticket.productId);
    setBruto(ticket.bruto);
    setTara(ticket.tara);
    setRafaksiPct(ticket.rafaksiPct);
    setPricePerKg(ticket.pricePerKg);
    setUnloadingFeePerKg(ticket.unloadingFeePerKg);
    setHasAffiliate(!!ticket.affiliateId);
    setSelectedAffiliateId(ticket.affiliateId || '');
    setAffiliateFeePerKg(ticket.affiliateFeePerKg || 20);
    setPaymentStatus(ticket.paymentStatus);
    setNotes(ticket.notes || '');
  };

  const handleDelete = async (id: string, number: string) => {
    if (window.confirm(`Hapus tiket timbang ${number}? Selisih stok dan saldo kas akan dikoreksi otomatis.`)) {
      await storage.deleteWeighingTicket(id);
      await refreshData();
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTicket(null);
    resetForm();
  };

  const resetForm = () => {
    setBruto('');
    setTara('');
    setNotes('');
    setEditingTicket(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setSelectedPartyId('');
    setCustomFarmerName('');
    setVehiclePlate('');
    setProductId('TBS');
    setRafaksiPct(settings.defaultRafaksiPct || 3.0);
    setPricePerKg(2650);
    setUnloadingFeePerKg(settings.defaultUnloadingFeePerKg || 15);
    setHasAffiliate(false);
    setSelectedAffiliateId('');
    setAffiliateFeePerKg(20);
    setPaymentStatus('LUNAS');
  };

  // When farmer party is picked, auto-populate vehicle plate
  const handleSelectParty = (partyId: string) => {
    setSelectedPartyId(partyId);
    if (partyId === 'NEW') {
      setCustomFarmerName('');
      setVehiclePlate('');
    } else {
      const p = parties.find((party) => party.id === partyId);
      if (p) {
        setCustomFarmerName(p.name);
        if (p.vehiclePlate) setVehiclePlate(p.vehiclePlate);
      }
    }
  };

  // When product changes, auto-set default price and rafaksi
  const handleProductChange = (pId: ProductTypeId) => {
    setProductId(pId);
    const prod = products.find((p) => p.id === pId);
    if (prod) {
      setPricePerKg(prod.defaultPricePerKg);
      setRafaksiPct(prod.defaultRafaksiPct);
    }
  };

  // Live Formula Calculations
  const numBruto = Number(bruto) || 0;
  const numTara = Number(tara) || 0;
  const netto1 = Math.max(0, numBruto - numTara);
  const rafaksiKg = Math.round(netto1 * (rafaksiPct / 100));
  const netto2 = Math.max(0, netto1 - rafaksiKg);
  const baseAmount = netto2 * pricePerKg;
  const totalUnloadingFee = netto2 * unloadingFeePerKg;
  const farmerPayment = Math.max(0, baseAmount - totalUnloadingFee);
  const totalAffiliateFee = hasAffiliate ? netto2 * affiliateFeePerKg : 0;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {

    if (numBruto <= 0 || numTara < 0 || numBruto <= numTara) {
      alert('Berat Bruto harus lebih besar daripada berat Tara!');
      return;
    }

    let farmerName = customFarmerName.trim();
    let partyId = selectedPartyId;

    if (!partyId || partyId === 'NEW') {
      if (!farmerName) {
        alert('Silakan masukkan nama petani/penjual buah!');
        return;
      }
      // Create new party automatically
      const newP = await storage.addParty({
        type: 'PETANI',
        name: farmerName,
        phone: '-',
        vehiclePlate: vehiclePlate.toUpperCase(),
      });
      if (newP) partyId = newP.id;
    } else {
      const existing = parties.find((p) => p.id === partyId);
      if (existing) farmerName = existing.name;
    }

    const prod = products.find((p) => p.id === productId);
    const affiliate = hasAffiliate
      ? parties.find((p) => p.id === selectedAffiliateId)
      : null;

    const tNumber = editingTicket ? editingTicket.ticketNumber : await storage.generateTicketNumber();

    const ticketData = {
      ticketNumber: tNumber,
      date,
      time,
      partyId,
      farmerName,
      vehiclePlate: vehiclePlate.toUpperCase(),
      productId,
      productName: prod ? prod.name : 'TBS Sawit',
      bruto: numBruto,
      tara: numTara,
      netto1,
      rafaksiPct,
      rafaksiKg,
      netto2,
      pricePerKg,
      baseAmount,
      unloadingFeePerKg,
      totalUnloadingFee,
      farmerPayment,
      affiliateId: affiliate ? affiliate.id : undefined,
      affiliateName: affiliate ? affiliate.name : undefined,
      affiliateFeePerKg: hasAffiliate ? affiliateFeePerKg : undefined,
      totalAffiliateFee: hasAffiliate ? totalAffiliateFee : undefined,
      cashAccountId: editingTicket ? editingTicket.cashAccountId : 'KAS_ADMIN',
      paymentStatus,
      paidAt: paymentStatus === 'LUNAS' ? (editingTicket?.paidAt || new Date().toISOString()) : undefined,
      createdBy: editingTicket ? editingTicket.createdBy : currentUser.id,
      operatorName: editingTicket ? editingTicket.operatorName : currentUser.name,
      notes,
    };

      if (editingTicket) {
        await storage.updateWeighingTicket(editingTicket.id, ticketData);
        alert('Tiket berhasil diperbarui!');
        await refreshData();
        handleCloseForm();
      } else {
        const createdTicket = await storage.addWeighingTicket(ticketData);
        if (createdTicket) {
          await refreshData();
          handleCloseForm();
          onOpenPrint(createdTicket);
        } else {
          alert('Gagal menyimpan tiket timbang.');
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Terjadi kesalahan saat menyimpan tiket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.farmerName.toLowerCase().includes(search.toLowerCase()) ||
      t.vehiclePlate.toLowerCase().includes(search.toLowerCase());

    const matchesProduct =
      selectedProductFilter === 'ALL' || t.productId === selectedProductFilter;

    return matchesSearch && matchesProduct;
  });

  const farmerParties = parties.filter((p) => p.type === 'PETANI');
  const affiliateParties = parties.filter((p) => p.type === 'AFFILIATE');

  return (
    <div className="space-y-3.5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            Timbang Petani & Pembelian Buah
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan timbangan bruto/tara, rafaksi otomatis, dan cetak tiket slip pembayaran
          </p>
        </div>

        <button
          onClick={() => isFormOpen ? handleCloseForm() : setIsFormOpen(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
        >
          <Plus className="w-4 h-4" />
          {isFormOpen ? 'Tutup Form' : 'Timbang Petani Baru'}
        </button>
      </div>

      {/* Weighing Input Form (Accordion or Card) */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-indigo-200/90 shadow-xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
              <h3 className="font-bold text-slate-900 text-base">
                {editingTicket ? `Edit Tiket: ${editingTicket.ticketNumber}` : 'Formulir Penimbangan Sawit Baru'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
              {editingTicket ? `ID: ${editingTicket.id.slice(-8)}` : `Auto No: ${storage.generateTicketNumber()}`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Date & Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tanggal & Jam Timbang
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>
            </div>

            {/* 2. Farmer Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Petani / Pemilik Buah
              </label>
              <select
                value={selectedPartyId}
                onChange={(e) => handleSelectParty(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 font-semibold"
                required
              >
                <option value="">-- Pilih Petani Terdaftar --</option>
                {farmerParties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.vehiclePlate ? `(${p.vehiclePlate})` : ''}
                  </option>
                ))}
                <option value="NEW">+ Input Petani Baru (Ketik Manual)</option>
              </select>
            </div>

            {/* Farmer Name & Vehicle Plate */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Petani & No. Polisi Kendaraan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nama Petani"
                  value={customFarmerName}
                  onChange={(e) => setCustomFarmerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
                <input
                  type="text"
                  placeholder="Contoh: BK 8219 XL"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 uppercase font-mono font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Product Type & Pricing Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Jenis Produk
              </label>
              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value as ProductTypeId)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-indigo-900"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Harga Beli (Rp/kg)
              </label>
              <input
                type="number"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                min={0}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Potongan Rafaksi (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={rafaksiPct}
                  onChange={(e) => setRafaksiPct(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-rose-600"
                  min={0}
                  max={50}
                  required
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Upah Bongkar (Rp/kg)
              </label>
              <input
                type="number"
                value={unloadingFeePerKg}
                onChange={(e) => setUnloadingFeePerKg(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-semibold text-slate-800"
                min={0}
              />
            </div>
          </div>

          {/* Weighing Breakdown Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-3.5 rounded-2xl border-2 border-indigo-100 shadow-xs">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                1. Bruto (kg)
              </label>
              <input
                type="number"
                placeholder="0"
                value={bruto}
                onChange={(e) =>
                  setBruto(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full text-lg font-black font-mono text-slate-900 focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-400">Berat kendaraan + buah</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border-2 border-indigo-100 shadow-xs">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                2. Tara (kg)
              </label>
              <input
                type="number"
                placeholder="0"
                value={tara}
                onChange={(e) =>
                  setTara(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full text-lg font-black font-mono text-slate-900 focus:outline-none"
                required
              />
              <span className="text-[10px] text-slate-400">Berat kendaraan kosong</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Netto 1 (kg)
              </span>
              <div className="text-lg font-black font-mono text-slate-900">
                {netto1.toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-indigo-600 font-semibold">Bruto - Tara</span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Pot. Rafaksi (kg)
              </span>
              <div className="text-lg font-black font-mono text-rose-600">
                -{rafaksiKg.toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-slate-400">{rafaksiPct}% dari Netto 1</span>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/70 p-3.5 rounded-2xl border border-indigo-200">
              <span className="block text-[11px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                Netto 2 Bersih (kg)
              </span>
              <div className="text-xl font-black font-mono text-indigo-800">
                {netto2.toLocaleString('id-ID')}
              </div>
              <span className="text-[10px] text-indigo-600 font-semibold">Netto 1 - Rafaksi</span>
            </div>
          </div>

          {/* Optional Affiliate Section */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAffiliate}
                  onChange={(e) => setHasAffiliate(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-amber-900">
                  Ada Komisi Affiliate / Rombongan / Calo Buah?
                </span>
              </label>
              {hasAffiliate && (
                <span className="text-xs font-bold text-amber-800 font-mono">
                  Total Komisi: {formatRupiah(totalAffiliateFee)}
                </span>
              )}
            </div>

            {hasAffiliate && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-200/60">
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Pilih Nama Affiliate
                  </label>
                  <select
                    value={selectedAffiliateId}
                    onChange={(e) => setSelectedAffiliateId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg"
                    required={hasAffiliate}
                  >
                    <option value="">-- Pilih Affiliate --</option>
                    {affiliateParties.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Tarif Komisi (Rp/kg Netto 2)
                  </label>
                  <input
                    type="number"
                    value={affiliateFeePerKg}
                    onChange={(e) => setAffiliateFeePerKg(Number(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Financial Summary & Submit */}
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                Total Pembayaran Petani:
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-900">
                {formatRupiah(farmerPayment)}
              </div>
              <p className="text-[11px] text-emerald-700">
                Nilai Dasar ({formatRupiah(baseAmount)}) - Upah Bongkar (
                {formatRupiah(totalUnloadingFee)})
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as 'LUNAS' | 'BELUM_LUNAS')
                }
                className="px-3 py-2.5 text-xs font-bold rounded-xl border border-emerald-300 bg-white text-emerald-950"
              >
                <option value="LUNAS">LUNAS (Potong Kas Admin)</option>
                <option value="BELUM_LUNAS">BELUM LUNAS (Hutang RAM)</option>
              </select>

              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 md:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{editingTicket ? 'Perbarui Tiket' : 'Simpan & Cetak Slip'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tickets List Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Search & Filter Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tiket, petani, nomor plat..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter:</span>
            <select
              value={selectedProductFilter}
              onChange={(e) => setSelectedProductFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
            >
              <option value="ALL">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-2 whitespace-nowrap">No. Tiket / Waktu</th>
                <th className="py-2 px-2">Petani / Armada</th>
                <th className="py-2 px-2">Produk</th>
                <th className="py-2 px-2 text-right">Bruto/Tara</th>
                <th className="py-2 px-2 text-right">Netto 1</th>
                <th className="py-2 px-2 text-right">Rafaksi</th>
                <th className="py-2 px-2 text-right">Netto 2</th>
                <th className="py-2 px-2 text-right">Harga</th>
                <th className="py-2 px-2 text-right">Pembayaran</th>
                <th className="py-2 px-2 text-center">Status</th>
                <th className="py-2 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-4 text-center text-slate-400">
                    Tidak ada tiket timbang yang cocok.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <div className="flex flex-col leading-none">
                        <span className="font-mono font-bold text-slate-900">{t.ticketNumber}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">{t.date} {t.time}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-col leading-none">
                        <span className="font-bold text-slate-800">{t.farmerName}</span>
                        <span className="text-[9px] text-indigo-600 font-mono mt-0.5">{t.vehiclePlate}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded-[4px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100/50">
                        {t.productId}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-500 whitespace-nowrap">
                      {t.bruto}/{t.tara}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-800">
                      {t.netto1.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-rose-600">
                      -{t.rafaksiKg} <span className="text-[8px] opacity-60">({t.rafaksiPct}%)</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-black text-indigo-900">
                      {t.netto2.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                      {Math.round(t.pricePerKg).toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                      {Math.round(t.farmerPayment).toLocaleString('id-ID')}
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
                        <button
                          onClick={() => handleEdit(t)}
                          className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onOpenPrint(t)}
                          className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition-colors"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id, t.ticketNumber)}
                          className="p-1 rounded-md text-rose-600 hover:bg-rose-50 border border-rose-100 transition-colors"
                          title="Hapus Tiket"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

