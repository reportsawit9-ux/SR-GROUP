import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Scale,
  ShieldCheck,
  FileCheck,
  DollarSign,
  ArrowRight,
  Trash2,
  Printer,
  Search,
  X,
  FileText,
  Truck,
  Check,
} from 'lucide-react';
import { FactorySale, Shipment, UserProfile, Party, ProductType } from '../types';
import { storage } from '../lib/storage';

interface FactorySalesSectionProps {
  currentUser: UserProfile;
}

export const FactorySalesSection: React.FC<FactorySalesSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [sales, setSales] = useState<FactorySale[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Mode: Dari Surat Jalan Truk atau Input Penjualan Langsung
  const [saleSourceType, setSaleSourceType] = useState<'SHIPMENT' | 'DIRECT'>('SHIPMENT');

  // Form Fields - Shipment Source
  const [selectedShipmentId, setSelectedShipmentId] = useState('');

  // Form Fields - Direct Source
  const [directFactoryId, setDirectFactoryId] = useState('');
  const [directFactoryName, setDirectFactoryName] = useState('');
  const [directProductId, setDirectProductId] = useState('TBS');
  const [directVehiclePlate, setDirectVehiclePlate] = useState('');
  const [directDriverName, setDirectDriverName] = useState('');
  const [directRamNettoKg, setDirectRamNettoKg] = useState<number | ''>('');

  // Form Common Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [factoryBruto, setFactoryBruto] = useState<number | ''>('');
  const [factoryTara, setFactoryTara] = useState<number | ''>('');
  const [factoryRafaksiPct, setFactoryRafaksiPct] = useState<number>(2.0);
  const [sellingPricePerKg, setSellingPricePerKg] = useState<number>(2850);
  const [factoryDeductions, setFactoryDeductions] = useState<number>(0);
  const [manualHpp, setManualHpp] = useState<number | ''>('');
  const [manualLoadingCost, setManualLoadingCost] = useState<number | ''>('');
  const [manualShippingCost, setManualShippingCost] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<FactorySale | null>(null);
  const [printSale, setPrintSale] = useState<FactorySale | null>(null);

  const refreshData = async () => {
    try {
      const [sl, sh, pa, pr] = await Promise.all([
        storage.getFactorySales(),
        storage.getShipments(),
        storage.getParties(),
        storage.getProducts(),
      ]);
      setSales(sl || []);
      setShipments(sh || []);
      setParties(pa || []);
      setProducts(pr || []);
    } catch (err) {
      console.error('Error refreshing sales data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filter pending shipments (DALAM_PERJALANAN)
  const pendingShipments = shipments.filter((s) => s.status === 'DALAM_PERJALANAN');
  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);
  const factoryList = parties.filter((p) => p.type === 'PABRIK');

  // If there are pending shipments, default to SHIPMENT mode, else DIRECT
  useEffect(() => {
    if (pendingShipments.length === 0 && saleSourceType === 'SHIPMENT') {
      // Keep option open, but allow switching smoothly
    }
  }, [pendingShipments.length]);

  // Update manual costs when shipment selection changes
  useEffect(() => {
    if (selectedShipment) {
      setManualHpp(selectedShipment.totalEstimatedHpp || 0);
      setManualLoadingCost(selectedShipment.loadingCost || 0);
      setManualShippingCost(selectedShipment.shippingCost || 0);
    } else if (saleSourceType === 'DIRECT') {
      // In direct mode, compute estimated HPP if RAM Netto and price given
      const ramNet = Number(directRamNettoKg) || 0;
      const defaultProd = products.find((p) => p.id === directProductId);
      const estHpp = ramNet * (defaultProd?.defaultPricePerKg || 2500);
      if (manualHpp === '') {
        setManualHpp(estHpp);
      }
    }
  }, [selectedShipmentId, shipments, saleSourceType, directRamNettoKg, directProductId]);

  // Live Calculations
  const ramNettoKg =
    saleSourceType === 'SHIPMENT'
      ? selectedShipment
        ? selectedShipment.ramNettoKg
        : 0
      : Number(directRamNettoKg) || 0;

  const numBruto = Number(factoryBruto) || 0;
  const numTara = Number(factoryTara) || 0;
  const factoryNetto1 = Math.max(0, numBruto - numTara);
  const factoryRafaksiKg = Math.round(factoryNetto1 * (factoryRafaksiPct / 100));
  const factoryNetto2 = Math.max(0, factoryNetto1 - factoryRafaksiKg);

  // Shrinkage (Susut Timbang)
  const shrinkageKg = Math.max(0, ramNettoKg - factoryNetto1);
  const shrinkagePct = ramNettoKg > 0 ? (shrinkageKg / ramNettoKg) * 100 : 0;

  // Revenue & Profit
  const totalGrossSale = factoryNetto2 * sellingPricePerKg;
  const totalNetSale = Math.max(0, totalGrossSale - Number(factoryDeductions || 0));
  const actualHpp = Number(manualHpp) || 0;
  const loadingCost = Number(manualLoadingCost) || 0;
  const shippingCost = Number(manualShippingCost) || 0;
  const grossProfit = totalNetSale - (actualHpp + loadingCost + shippingCost);

  // Summary Metrics
  const totalNetSalesVolume = sales.reduce((acc, s) => acc + (s.factoryNetto2 || 0), 0);
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (s.totalNetSale || 0), 0);
  const totalGrossProfit = sales.reduce((acc, s) => acc + (s.grossProfit || 0), 0);
  const avgShrinkage =
    sales.length > 0
      ? sales.reduce((acc, s) => acc + (s.shrinkagePct || 0), 0) / sales.length
      : 0;

  const handleOpenForm = () => {
    setIsFormOpen(true);
    setNotification(null);
    if (pendingShipments.length > 0) {
      setSaleSourceType('SHIPMENT');
      setSelectedShipmentId(pendingShipments[0].id);
    } else {
      setSaleSourceType('DIRECT');
      if (factoryList.length > 0) {
        setDirectFactoryId(factoryList[0].id);
        setDirectFactoryName(factoryList[0].name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (numBruto <= 0 || numTara < 0 || numBruto <= numTara) {
      setNotification({
        type: 'error',
        message: 'Nilai timbangan Bruto PKS harus lebih besar daripada Tara PKS!',
      });
      return;
    }

    if (saleSourceType === 'SHIPMENT' && !selectedShipment) {
      setNotification({
        type: 'error',
        message: 'Silakan pilih surat jalan pengiriman truk yang akan disahkan penjualannya!',
      });
      return;
    }

    if (saleSourceType === 'DIRECT') {
      const fName =
        directFactoryName.trim() ||
        parties.find((p) => p.id === directFactoryId)?.name ||
        'PKS Pabrik Kelapa Sawit';
      if (!fName) {
        setNotification({
          type: 'error',
          message: 'Silakan pilih atau ketik nama Pabrik PKS pembeli!',
        });
        return;
      }
    }

    setIsSubmitting(true);
    setNotification(null);

    try {
      const saleNumber = await storage.generateSaleNumber();

      let targetShipmentId = '';
      let targetShipmentNumber = '- (Penjualan Langsung)';
      let targetFactoryId = '';
      let targetFactoryName = '';
      let targetProductId = 'TBS';
      let targetProductName = 'TBS (Kelapa Sawit)';
      let targetItems = undefined;

      if (saleSourceType === 'SHIPMENT' && selectedShipment) {
        targetShipmentId = selectedShipment.id;
        targetShipmentNumber = selectedShipment.shipmentNumber;
        targetFactoryId = selectedShipment.factoryId;
        targetFactoryName = selectedShipment.factoryName;
        targetProductId = selectedShipment.productId || 'TBS';
        targetProductName = selectedShipment.productName || 'TBS';
        targetItems = selectedShipment.items;
      } else {
        const pickedFactory = parties.find((p) => p.id === directFactoryId);
        targetFactoryId = directFactoryId;
        targetFactoryName = directFactoryName.trim() || pickedFactory?.name || 'PKS Pembeli';
        targetProductId = directProductId;
        const prod = products.find((p) => p.id === directProductId);
        targetProductName = prod?.name || directProductId;
      }

      const created = await storage.addFactorySale({
        saleNumber,
        shipmentId: targetShipmentId,
        shipmentNumber: targetShipmentNumber,
        date,
        factoryId: targetFactoryId,
        factoryName: targetFactoryName,
        productId: targetProductId as any,
        productName: targetProductName,
        items: targetItems,
        ramNettoKg,
        factoryBruto: numBruto,
        factoryTara: numTara,
        factoryNetto1,
        factoryRafaksiPct,
        factoryRafaksiKg,
        factoryNetto2,
        shrinkageKg,
        shrinkagePct: Number(shrinkagePct.toFixed(2)),
        sellingPricePerKg,
        totalGrossSale,
        factoryDeductions: Number(factoryDeductions || 0),
        totalNetSale,
        actualHpp,
        loadingCost,
        shippingCost,
        grossProfit,
        paymentStatus: 'LUNAS',
        cashAccountId: 'KAS_OWNER',
        approvedByOwner: true,
        approvedAt: new Date().toISOString(),
        approvedByName: currentUser.name,
        notes: notes.trim()
          ? `${notes.trim()}${saleSourceType === 'DIRECT' ? ` [Armada: ${directVehiclePlate || '-'} / ${directDriverName || '-'}]` : ''}`
          : saleSourceType === 'DIRECT'
          ? `Penjualan Langsung Pabrik [Armada: ${directVehiclePlate || '-'} / ${directDriverName || '-'}]`
          : undefined,
      });

      await refreshData();
      setIsFormOpen(false);

      // Reset form
      setSelectedShipmentId('');
      setFactoryBruto('');
      setFactoryTara('');
      setManualHpp('');
      setManualLoadingCost('');
      setManualShippingCost('');
      setNotes('');
      setDirectRamNettoKg('');
      setDirectVehiclePlate('');
      setDirectDriverName('');

      if (created) {
        setNotification({
          type: 'success',
          message: `Penjualan ${saleNumber} berhasil disahkan! Dana Rp ${totalNetSale.toLocaleString('id-ID')} dicatat ke Kas Owner.`,
        });
        setPrintSale(created);
      }
    } catch (err: any) {
      console.error('Error adding factory sale:', err);
      setNotification({
        type: 'error',
        message: `Terjadi kesalahan saat mengesahkan penjualan: ${err.message || 'Gagal menyimpan'}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;
    try {
      await storage.deleteFactorySale(saleToDelete.id);
      await refreshData();
      setNotification({
        type: 'success',
        message: `Penjualan ${saleToDelete.saleNumber} berhasil dihapus. Status surat jalan dikembalikan.`,
      });
    } catch (err: any) {
      console.error('Error deleting sale:', err);
      setNotification({
        type: 'error',
        message: 'Gagal menghapus penjualan.',
      });
    } finally {
      setSaleToDelete(null);
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.saleNumber.toLowerCase().includes(q) ||
      (s.shipmentNumber && s.shipmentNumber.toLowerCase().includes(q)) ||
      (s.factoryName && s.factoryName.toLowerCase().includes(q)) ||
      (s.productName && s.productName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner / Navigation Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              MODUL AKTIF
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Penjualan Pabrik & Timbang PKS
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengesahan timbangan bruto/tara pabrik, kalkulasi susut muatan, harga jual, dan pengakuan laba kotor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
              } else {
                handleOpenForm();
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isFormOpen ? 'Tutup Formulir' : 'Input / Sahkan Penjualan PKS'}</span>
          </button>
        </div>
      </div>

      {/* In-app Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Omzet Penjualan PKS</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 mt-1">
            {formatRupiah(totalSalesRevenue)}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Dari {sales.length} transaksi sah</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Netto 2 Terjual</span>
            <Scale className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-indigo-950 mt-1">
            {totalNetSalesVolume.toLocaleString('id-ID')} <span className="text-xs font-semibold">kg</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Berat bersih diakui PKS</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Rata-Rata Susut</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-amber-700 mt-1">
            {avgShrinkage.toFixed(2)}%
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Toleransi normal &lt; 0.6%</p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase">Total Laba Kotor</span>
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-900 mt-1">
            {formatRupiah(totalGrossProfit)}
          </div>
          <p className="text-[10px] text-emerald-700/80 mt-0.5">Setelah HPP & Ongkos Truk</p>
        </div>
      </div>

      {/* Form Reconciliation / Input Penjualan */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-indigo-200 shadow-xl p-4 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Formulir Pengesahan Penjualan Timbangan Pabrik PKS
                </h3>
                <p className="text-[11px] text-slate-500">
                  Masukkan hasil timbang bruto & tara dari slip timbang PKS untuk mengesahkan penjualan
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 self-start sm:self-auto">
              Auto No: FKS-YYYYMMDD-XXX
            </span>
          </div>

          {/* Source Selector: Dari Surat Jalan Truk vs Penjualan Langsung */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl max-w-md">
            <button
              type="button"
              onClick={() => setSaleSourceType('SHIPMENT')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                saleSourceType === 'SHIPMENT'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Dari Surat Jalan Truk ({pendingShipments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSaleSourceType('DIRECT')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                saleSourceType === 'DIRECT'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Penjualan Langsung / Mandiri</span>
            </button>
          </div>

          {/* Section 1: Selection depending on Source Mode */}
          {saleSourceType === 'SHIPMENT' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Surat Jalan Truk (Yang Sedang Dikirim / Menuju PKS)
                </label>
                <select
                  value={selectedShipmentId}
                  onChange={(e) => setSelectedShipmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                >
                  <option value="">-- Pilih Surat Jalan Truk --</option>
                  {pendingShipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shipmentNumber} • {s.factoryName} • {s.ramNettoKg.toLocaleString('id-ID')} kg ({s.vehiclePlate} - {s.driverName})
                    </option>
                  ))}
                </select>
                {pendingShipments.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Tidak ada truk pengiriman berstatus 'Dalam Perjalanan'. Gunakan tab <b>"Penjualan Langsung"</b> di atas bila ingin mencatat penjualan tanpa surat jalan.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tanggal Pengesahan Penjualan
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pabrik PKS Pembeli
                </label>
                <select
                  value={directFactoryId}
                  onChange={(e) => {
                    setDirectFactoryId(e.target.value);
                    const fac = parties.find((p) => p.id === e.target.value);
                    if (fac) setDirectFactoryName(fac.name);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                >
                  <option value="">-- Pilih Pabrik PKS Terdaftar --</option>
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Atau ketik nama PKS baru..."
                  value={directFactoryName}
                  onChange={(e) => setDirectFactoryName(e.target.value)}
                  className="w-full mt-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Komoditas & Berat Timbang RAM (kg)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={directProductId}
                    onChange={(e) => setDirectProductId(e.target.value)}
                    className="w-full px-2 py-2 text-xs bg-white border border-slate-200 rounded-xl font-bold"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Netto RAM (kg)"
                    value={directRamNettoKg}
                    onChange={(e) =>
                      setDirectRamNettoKg(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-2 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tanggal & Armada Truk (Opsional)
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl mb-1.5 font-medium"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="No Polisi (BM 1234 CD)"
                    value={directVehiclePlate}
                    onChange={(e) => setDirectVehiclePlate(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-xl uppercase font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Nama Sopir"
                    value={directDriverName}
                    onChange={(e) => setDirectDriverName(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selected Shipment Summary Card */}
          {saleSourceType === 'SHIPMENT' && selectedShipment && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-slate-500">Truk & Sopir:</span>
                <p className="font-bold text-slate-900 font-mono">
                  {selectedShipment.vehiclePlate} • {selectedShipment.driverName}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Pabrik PKS:</span>
                <p className="font-bold text-indigo-900">{selectedShipment.factoryName}</p>
              </div>
              <div>
                <span className="text-slate-500">Netto Timbang RAM:</span>
                <p className="font-black text-slate-900 font-mono text-sm">
                  {ramNettoKg.toLocaleString('id-ID')} kg
                </p>
              </div>
              <div>
                <span className="text-slate-500">Estimasi HPP Buah:</span>
                <p className="font-bold text-slate-900 font-mono">
                  {formatRupiah(selectedShipment.totalEstimatedHpp)}
                </p>
              </div>

              {selectedShipment.items && selectedShipment.items.length > 0 && (
                <div className="w-full mt-1 pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 font-semibold text-[11px]">Rincian Muatan:</span>
                  {selectedShipment.items.map((it, idx) => (
                    <span
                      key={idx}
                      className="bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-900 border border-indigo-200"
                    >
                      {it.productName}: <span className="font-mono">{it.nettoKg.toLocaleString('id-ID')} kg</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Factory Weighbridge Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bruto Timbangan PKS (kg)
              </label>
              <input
                type="number"
                placeholder="Contoh: 12500"
                value={factoryBruto}
                onChange={(e) =>
                  setFactoryBruto(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tara Timbangan PKS (kg)
              </label>
              <input
                type="number"
                placeholder="Contoh: 4200"
                value={factoryTara}
                onChange={(e) =>
                  setFactoryTara(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Potongan Rafaksi PKS (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={factoryRafaksiPct}
                onChange={(e) => setFactoryRafaksiPct(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Jual ke PKS (Rp/kg)
              </label>
              <input
                type="number"
                value={sellingPricePerKg}
                onChange={(e) => setSellingPricePerKg(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>
          </div>

          {/* Cost breakdown & HPP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                HPP Buah (Modal Beli Petani)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualHpp}
                  onChange={(e) =>
                    setManualHpp(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  Rp
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                Upah Muat (Bongkar/Muat)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualLoadingCost}
                  onChange={(e) =>
                    setManualLoadingCost(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  Rp
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                Ongkos Angkut Truk
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualShippingCost}
                  onChange={(e) =>
                    setManualShippingCost(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  Rp
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                Potongan Lain PKS (Rp)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={factoryDeductions}
                  onChange={(e) => setFactoryDeductions(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-rose-700"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  Rp
                </span>
              </div>
            </div>
          </div>

          {/* Analytics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Netto 2 Sah Pabrik (kg)
              </span>
              <div className="text-xl font-black font-mono text-indigo-950 mt-1">
                {factoryNetto2.toLocaleString('id-ID')} kg
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Netto 1 ({factoryNetto1.toLocaleString('id-ID')}) - Rafaksi ({factoryRafaksiKg} kg)
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Susut Timbang (RAM vs PKS)
              </span>
              <div className={`text-xl font-black font-mono ${shrinkageKg >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1`}>
                {shrinkageKg >= 0 ? '+' : ''}{shrinkageKg.toLocaleString('id-ID')} kg ({shrinkagePct >= 0 ? '+' : ''}{shrinkagePct.toFixed(2)}%)
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Batas normal toleransi susut jalan &lt; 0.6%
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">
                Laba Kotor Transaksi
              </span>
              <div className="text-xl font-black font-mono text-emerald-900 mt-1">
                {formatRupiah(grossProfit)}
              </div>
              <p className="text-[10px] text-emerald-700 mt-0.5">
                Penjualan Bersih: {formatRupiah(totalNetSale)}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Penjualan / Nomor Faktur PKS (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Faktur No. PKS-991, Mutu buah super, potongan normal"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan & Mengesahkan...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Sahkan Penjualan & Simpan ke Kas Owner</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Verified Sales Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Daftar Riwayat Penjualan Pabrik PKS</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh transaksi penjualan yang telah disahkan dan masuk ke catatan keuangan
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari penjualan / PKS..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {filteredSales.length} Penjualan
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tight text-[10px]">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">No. Penjualan / SJ</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">PKS Pembeli</th>
                <th className="py-2.5 px-3 text-right">RAM vs PKS (kg)</th>
                <th className="py-2.5 px-3 text-right">Susut</th>
                <th className="py-2.5 px-3 text-right">Harga (Rp/kg)</th>
                <th className="py-2.5 px-3 text-right">Total Net (Rp)</th>
                <th className="py-2.5 px-3 text-right">Laba Kotor</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    <p className="text-xs font-medium">Belum ada data penjualan pabrik yang tercatat.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Klik tombol <b>"Input / Sahkan Penjualan PKS"</b> di atas untuk mencatat penjualan.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3.5 whitespace-nowrap">
                      <div className="flex flex-col leading-none">
                        <span className="font-mono font-bold text-slate-900">{s.saleNumber}</span>
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {s.shipmentNumber || 'Penjualan Langsung'}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600 font-medium">
                      {s.date}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-800">
                      <div>{s.factoryName}</div>
                      <div className="text-[9px] font-semibold text-indigo-600">
                        {s.productName || 'TBS'}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right leading-tight whitespace-nowrap">
                      <div className="flex flex-col leading-none">
                        <span className="font-mono text-slate-400 text-[9px]">
                          RAM: {s.ramNettoKg.toLocaleString('id-ID')}
                        </span>
                        <span className="font-mono font-black text-indigo-950 mt-0.5">
                          PKS: {s.factoryNetto2.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold whitespace-nowrap">
                      {s.shrinkageKg} <span className="text-[9px] opacity-70">({s.shrinkagePct}%)</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {s.sellingPricePerKg.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                      {s.totalNetSale.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-indigo-700 whitespace-nowrap">
                      +{s.grossProfit.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        LUNAS
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setPrintSale(s)}
                          className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors border border-indigo-200"
                          title="Cetak Faktur Penjualan PKS"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSaleToDelete(s)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors border border-rose-200"
                          title="Hapus Penjualan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Delete Confirmation Modal (In-App, no window.confirm) */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Hapus Data Penjualan Pabrik?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Penjualan nomor <b>{saleToDelete.saleNumber}</b> ke <b>{saleToDelete.factoryName}</b> sebesar{' '}
              <b>Rp {saleToDelete.totalNetSale.toLocaleString('id-ID')}</b> akan dihapus.
              {saleToDelete.shipmentId && (
                <span className="block mt-1 text-indigo-700 font-semibold">
                  Status surat jalan ({saleToDelete.shipmentNumber}) akan dikembalikan menjadi 'Dalam Perjalanan'.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
              >
                Ya, Hapus Penjualan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice Modal (Faktur Penjualan PKS) */}
      {printSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Faktur Penjualan Pabrik Kelapa Sawit (PKS)
              </h3>
              <button
                onClick={() => setPrintSale(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Print Document Body */}
            <div className="border border-slate-300 p-5 rounded-2xl font-mono text-xs space-y-3 bg-white">
              <div className="text-center border-b pb-3 border-slate-200">
                <h4 className="font-bold text-base text-slate-900">RAM SUMBER REZEKI</h4>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  FAKTUR PENJUALAN PABRIK KELAPA SAWIT
                </p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="font-bold text-indigo-900 text-sm">{printSale.saleNumber}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-[11px] text-slate-600">{printSale.date}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Pabrik PKS Pembeli:</span>
                  <span className="font-bold text-slate-900">{printSale.factoryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref. Surat Jalan:</span>
                  <span className="font-bold">{printSale.shipmentNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Komoditas:</span>
                  <span className="font-bold text-indigo-900">{printSale.productName || 'TBS'}</span>
                </div>
              </div>

              {/* Timbang Comparison Table */}
              <div className="pt-2">
                <span className="font-bold text-slate-800 block mb-1">
                  Perbandingan Timbangan RAM vs PKS:
                </span>
                <table className="w-full text-left border border-slate-300 text-[11px]">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 border-r border-slate-200 text-slate-600">
                        Netto Timbangan RAM
                      </td>
                      <td className="p-1.5 text-right font-bold">
                        {printSale.ramNettoKg.toLocaleString('id-ID')} kg
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 border-r border-slate-200 text-slate-600">
                        Bruto PKS - Tara PKS (Netto 1)
                      </td>
                      <td className="p-1.5 text-right font-bold">
                        {printSale.factoryBruto.toLocaleString('id-ID')} - {printSale.factoryTara.toLocaleString('id-ID')} = {printSale.factoryNetto1.toLocaleString('id-ID')} kg
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 border-r border-slate-200 text-slate-600">
                        Potongan Rafaksi PKS
                      </td>
                      <td className="p-1.5 text-right font-bold text-rose-600">
                        {printSale.factoryRafaksiPct}% ({printSale.factoryRafaksiKg.toLocaleString('id-ID')} kg)
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-indigo-50/70">
                      <td className="p-1.5 border-r border-slate-200 font-bold text-indigo-950">
                        NETTO 2 SAH PKS
                      </td>
                      <td className="p-1.5 text-right font-black text-indigo-950 text-xs">
                        {printSale.factoryNetto2.toLocaleString('id-ID')} kg
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-1.5 bg-slate-50 border-r border-slate-200 text-slate-600">
                        Susut Timbang Muatan
                      </td>
                      <td className="p-1.5 text-right font-bold text-rose-600">
                        {printSale.shrinkageKg.toLocaleString('id-ID')} kg ({printSale.shrinkagePct}%)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial Calculation */}
              <div className="pt-2 space-y-1 text-[11px] border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Harga Jual ke PKS:</span>
                  <span className="font-bold">Rp {printSale.sellingPricePerKg.toLocaleString('id-ID')} / kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Nilai Kotor:</span>
                  <span>Rp {printSale.totalGrossSale.toLocaleString('id-ID')}</span>
                </div>
                {printSale.factoryDeductions > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Potongan Lain Pabrik:</span>
                    <span>- Rp {printSale.factoryDeductions.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm pt-1 border-t border-dashed text-emerald-800">
                  <span>TOTAL PENJUALAN BERSIH:</span>
                  <span>Rp {printSale.totalNetSale.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Profitability breakdown */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimasi HPP Buah:</span>
                  <span>Rp {printSale.actualHpp.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Biaya Angkut & Muat:</span>
                  <span>Rp {(printSale.shippingCost + printSale.loadingCost).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-indigo-900 pt-1 border-t border-slate-200">
                  <span>Estimasi Laba Kotor:</span>
                  <span>+ Rp {printSale.grossProfit.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {printSale.notes && (
                <div className="text-[10px] text-slate-500 italic">
                  Catatan: {printSale.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 text-center pt-4 text-[10px]">
                <div>
                  <p className="mb-8 text-slate-500">Pabrik PKS Pembeli</p>
                  <p className="font-bold border-t pt-1">( {printSale.factoryName} )</p>
                </div>
                <div>
                  <p className="mb-8 text-slate-500">Disahkan Oleh</p>
                  <p className="font-bold border-t pt-1">( {printSale.approvedByName || currentUser.name} )</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPrintSale(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                <Printer className="w-4 h-4" /> Cetak Faktur Penjualan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
