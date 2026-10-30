import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Printer,
  ChevronRight,
  AlertTriangle,
  FileText,
  Package,
  Layers,
  Scale,
  Trash2,
} from 'lucide-react';
import { Shipment, ShipmentItem, ProductTypeId, UserProfile, Party } from '../types';
import { storage } from '../lib/storage';

interface ShipmentSectionProps {
  currentUser: UserProfile;
}

export const ShipmentSection: React.FC<ShipmentSectionProps> = ({ currentUser }) => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any>({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [search, setSearch] = useState('');
  const [printShipment, setPrintShipment] = useState<Shipment | null>(null);
  const [autoShipmentNumber, setAutoShipmentNumber] = useState<string>('SJP-...');

  // Form Header Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
  const [factoryId, setFactoryId] = useState('');
  const [driverPartyId, setDriverPartyId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [shippingCost, setShippingCost] = useState<number>(300000);
  const [loadingCost, setLoadingCost] = useState<number>(0);

  // Multi-Commodity Loads per Truck
  // Supports TBS, Brondol, BRD Afkir, Buah Kecil in 1 truck
  const [commodityWeights, setCommodityWeights] = useState<Record<ProductTypeId, number | ''>>({
    TBS: '',
    BRONDOL: '',
    BUAH_KECIL: '',
    BRD_AFKIR: '',
  });

  const refreshData = async () => {
    try {
      const [sh, pa, pr, st, sNum] = await Promise.all([
        storage.getShipments(),
        storage.getParties(),
        storage.getProducts(),
        storage.getStockSummary(),
        storage.generateShipmentNumber(),
      ]);
      setShipments(sh);
      setParties(pa);
      setProducts(pr);
      setStockSummary(st);
      setAutoShipmentNumber(sNum);
    } catch (err) {
      console.error('Error refreshing shipment data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleEdit = (shipment: Shipment) => {
    if (shipment.status === 'SELESAI_TERJUAL') {
      alert('Surat jalan yang sudah terjual tidak dapat diedit!');
      return;
    }

    setEditingShipment(shipment);
    setIsFormOpen(true);
    
    setDate(shipment.date);
    setTime(shipment.time);
    setFactoryId(shipment.factoryId);
    
    // Find driver party if possible
    const driverParty = parties.find(p => p.name === shipment.driverName && p.type === 'SOPIR');
    setDriverPartyId(driverParty?.id || '');
    setDriverName(shipment.driverName);
    setVehiclePlate(shipment.vehiclePlate);
    setShippingCost(shipment.shippingCost || 0);
    setLoadingCost(shipment.loadingCost || 0);

    const weights: Record<ProductTypeId, number | ''> = {
      TBS: '',
      BRONDOL: '',
      BUAH_KECIL: '',
      BRD_AFKIR: '',
    };
    shipment.items?.forEach(item => {
      weights[item.productId as ProductTypeId] = item.nettoKg;
    });
    setCommodityWeights(weights);
  };

  const handleDelete = async (id: string, number: string) => {
    if (window.confirm(`Hapus surat jalan ${number}? Selisih stok dan saldo kas akan dikoreksi otomatis. Jika sudah terjual, data penjualan juga akan terhapus!`)) {
      await storage.deleteShipment(id);
      await refreshData();
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingShipment(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingShipment(null);
    setDate(new Date().toISOString().slice(0, 10));
    setTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    setFactoryId('');
    setDriverPartyId('');
    setDriverName('');
    setVehiclePlate('');
    setShippingCost(300000);
    setLoadingCost(0);
    setCommodityWeights({
      TBS: '',
      BRONDOL: '',
      BUAH_KECIL: '',
      BRD_AFKIR: '',
    });
  };

  const handleDriverChange = (pId: string) => {
    setDriverPartyId(pId);
    const driver = parties.find((p) => p.id === pId);
    if (driver) {
      setDriverName(driver.name);
      if (driver.vehiclePlate) setVehiclePlate(driver.vehiclePlate);
    }
  };

  const handleWeightChange = (prodId: ProductTypeId, val: string) => {
    const num = val === '' ? '' : Math.max(0, Number(val));
    setCommodityWeights((prev) => ({
      ...prev,
      [prodId]: num,
    }));
  };

  // Calculate total truck net weight and HPP
  const totalTruckWeight = Object.values(commodityWeights).reduce<number>(
    (acc, val) => acc + (Number(val) || 0),
    0
  );

  const calculatedItems: ShipmentItem[] = products
    .map((prod) => {
      const weight = Number(commodityWeights[prod.id as ProductTypeId]) || 0;
      if (weight <= 0) return null;
      const hpp = stockSummary[prod.id]?.avgPurchasePrice || prod.defaultPricePerKg;
      return {
        productId: prod.id,
        productName: prod.name,
        nettoKg: weight,
        estimatedHppPerKg: hpp,
        subtotalEstimatedHpp: weight * hpp,
      };
    })
    .filter((item): item is ShipmentItem => item !== null);

  const totalEstimatedHpp = calculatedItems.reduce(
    (acc, it) => acc + it.subtotalEstimatedHpp,
    0
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {

    if (totalTruckWeight <= 0 || calculatedItems.length === 0) {
      alert('Masukkan jumlah kg minimal untuk salah satu komoditas buah yang dimuat!');
      return;
    }

    if (!factoryId) {
      alert('Silakan pilih pabrik PKS tujuan pengiriman!');
      return;
    }

    if (!vehiclePlate) {
      alert('Nomor polisi truk tidak boleh kosong!');
      return;
    }

    // Check available stock warnings (only for new shipments, or if weight increased)
    const overstockedCommodities = calculatedItems.filter((item) => {
      const available = stockSummary[item.productId]?.currentStockKg || 0;
      // When editing, we should consider the old weight too, but for simplicity we just warn
      return item.nettoKg > (available + (editingShipment?.items?.find(it => it.productId === item.productId)?.nettoKg || 0));
    });

    if (overstockedCommodities.length > 0 && !editingShipment) {
      const names = overstockedCommodities
        .map(
          (o) =>
              `${o.productName} (${o.nettoKg} kg > stok ${stockSummary[o.productId]?.currentStockKg || 0} kg)`
        )
        .join(', ');
      const confirmExceed = window.confirm(
        `Perhatian: Muatan berikut melebihi catatan stok sistem: ${names}. Tetap lanjutkan?`
      );
      if (!confirmExceed) return;
    }

    const factory = parties.find((p) => p.id === factoryId);
    
    // Summary name (e.g. "TBS (3.000 kg), Brondol (800 kg)" or "Campuran")
    const productNameSummary = calculatedItems.map((c) => c.productName.split(' ')[0]).join(' + ');

    const sNumber = editingShipment ? editingShipment.shipmentNumber : await storage.generateShipmentNumber();

    const shipmentData = {
      shipmentNumber: sNumber,
      date,
      time,
      factoryId,
      factoryName: factory ? factory.name : 'PKS Kelapa Sawit',
      items: calculatedItems,
      productId: calculatedItems[0]?.productId || 'TBS',
      productName: productNameSummary,
      vehiclePlate: vehiclePlate.toUpperCase(),
      driverName: driverName || 'Sopir Ekspedisi',
      ramNettoKg: totalTruckWeight,
      status: editingShipment ? editingShipment.status : 'DALAM_PERJALANAN' as any,
      estimatedHppPerKg:
        totalTruckWeight > 0 ? Math.round(totalEstimatedHpp / totalTruckWeight) : 2650,
      totalEstimatedHpp,
      shippingCost,
      loadingCost,
      createdBy: editingShipment ? editingShipment.createdBy : currentUser.id,
    };

      if (editingShipment) {
        await storage.updateShipment(editingShipment.id, shipmentData);
        alert('Surat jalan berhasil diperbarui!');
        await refreshData();
        handleCloseForm();
      } else {
        const newShipment = await storage.addShipment(shipmentData);
        if (newShipment) {
          await refreshData();
          handleCloseForm();
          setPrintShipment(newShipment);
        } else {
          alert('Gagal menerbitkan surat jalan.');
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      alert('Terjadi kesalahan saat menyimpan surat jalan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const factoryList = parties.filter((p) => p.type === 'PABRIK');
  const driverList = parties.filter((p) => p.type === 'SOPIR');

  const filtered = shipments.filter(
    (s) =>
      s.shipmentNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.factoryName.toLowerCase().includes(search.toLowerCase()) ||
      s.vehiclePlate.toLowerCase().includes(search.toLowerCase()) ||
      s.driverName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3.5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-600" />
            Pengiriman ke Pabrik Kelapa Sawit (PKS)
          </h2>
          <p className="text-xs text-slate-500">
            Surat jalan armada truk dengan muatan multi-komoditas (TBS, Brondol, Buah Kecil, BRD Afkir)
          </p>
        </div>

        <button
          onClick={() => {
            if (isFormOpen) {
              handleCloseForm();
            } else {
              storage.generateShipmentNumber().then(setAutoShipmentNumber);
              setIsFormOpen(true);
            }
          }}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          {isFormOpen ? 'Tutup Form' : 'Terbitkan Surat Jalan Baru'}
        </button>
      </div>

      {/* Surat Jalan Form with Multi-Commodity Input */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-indigo-200/90 shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
              <h3 className="font-bold text-slate-900 text-base">
                {editingShipment ? `Edit Surat Jalan: ${editingShipment.shipmentNumber}` : 'Formulir Surat Jalan Pengiriman Truk ke PKS'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
              {editingShipment ? `No: ${editingShipment.shipmentNumber}` : `No: ${autoShipmentNumber}`}
            </span>
          </div>

          {/* Section 1: Tanggal, Pabrik PKS, Sopir & Kendaraan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tanggal & Waktu Berangkat
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pabrik Tujuan (PKS)
              </label>
              <select
                value={factoryId}
                onChange={(e) => setFactoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              >
                <option value="">-- Pilih Pabrik PKS Tujuan --</option>
                {factoryList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-1">
                Ongkos Angkut Truk (Kas Admin)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Upah Muat"
                    value={loadingCost}
                    onChange={(e) => setLoadingCost(Number(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400">Rp</span>
                  <div className="absolute -top-3.5 left-0 text-[9px] font-bold text-indigo-600">Upah Muat</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Sopir Terdaftar
              </label>
              <select
                value={driverPartyId}
                onChange={(e) => handleDriverChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
              >
                <option value="">-- Pilih Sopir --</option>
                {driverList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.vehiclePlate ? `(${d.vehiclePlate})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Sopir & No. Polisi Truk
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nama Sopir"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                  required
                />
                <input
                  type="text"
                  placeholder="Contoh: BK 8734 KL"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl uppercase font-mono font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: MULTI-COMMODITY LOADING BREAKDOWN */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Rincian Muatan per Jenis Buah dalam 1 Truk
                </h4>
                <p className="text-xs text-slate-500">
                  Masukkan berat (kg) untuk setiap komoditas yang dimuat pada armada ini
                </p>
              </div>

              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Total Muatan: {totalTruckWeight.toLocaleString('id-ID')} kg
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {products.map((prod) => {
                const stock = stockSummary[prod.id]?.currentStockKg || 0;
                const weight = commodityWeights[prod.id as ProductTypeId];
                const numWeight = Number(weight) || 0;
                const isOverStock = numWeight > stock;

                return (
                  <div
                    key={prod.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      numWeight > 0
                        ? 'bg-indigo-50/60 border-indigo-300 shadow-xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-extrabold text-xs text-slate-900">
                        {prod.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                        {prod.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                      <span>Stok di RAM:</span>
                      <span className="font-bold font-mono text-slate-800">
                        {stock.toLocaleString('id-ID')} kg
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Berat Muatan (kg):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0"
                          value={weight}
                          onChange={(e) => handleWeightChange(prod.id, e.target.value)}
                          className={`w-full px-3 py-2 text-sm font-mono font-black rounded-xl border ${
                            isOverStock
                              ? 'border-rose-400 bg-rose-50 text-rose-900'
                              : numWeight > 0
                              ? 'border-indigo-400 bg-white text-indigo-950'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                          min={0}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          kg
                        </span>
                      </div>
                      {isOverStock && (
                        <span className="text-[10px] text-rose-600 font-bold block mt-1">
                          ⚠️ Melebihi stok RAM ({stock.toLocaleString('id-ID')} kg)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Summary Box & Submit */}
          <div className="p-5 rounded-2xl bg-indigo-900 text-white flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Total Muatan Bersih Truk:
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                {totalTruckWeight.toLocaleString('id-ID')}{' '}
                <span className="text-base font-normal text-indigo-200">kg</span>
              </div>
              <p className="text-[11px] text-indigo-300">
                Komposisi: {calculatedItems.length > 0 ? calculatedItems.map((c) => `${c.productName} (${c.nettoKg.toLocaleString('id-ID')} kg)`).join(', ') : 'Belum ada muatan diinput'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseForm}
                className="px-4 py-2.5 rounded-xl border border-white/20 text-white text-xs font-semibold hover:bg-white/10"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menerbitkan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{editingShipment ? 'Perbarui Surat Jalan' : 'Terbitkan Surat Jalan & Kurangi Stok'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Shipments List */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari surat jalan, pabrik, sopir..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            Total {filtered.length} Surat Jalan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-3 whitespace-nowrap">Surat Jalan / Waktu</th>
                <th className="py-2 px-3">PKS / Armada</th>
                <th className="py-2 px-3">Rincian Muatan</th>
                <th className="py-2 px-3 text-right">Berat RAM</th>
                <th className="py-2 px-3 text-right">Biaya (Ongkos/Muat)</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono font-bold text-slate-900">{s.shipmentNumber}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">{s.date} {s.time}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3">
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-slate-800">{s.factoryName}</span>
                      <span className="text-[9px] text-indigo-600 font-mono mt-0.5 uppercase">
                        {s.driverName} • {s.vehiclePlate}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3">
                    {s.items && s.items.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {s.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-0 rounded bg-indigo-50 text-indigo-800 border border-indigo-100 whitespace-nowrap"
                          >
                            {it.productName.split(' ')[0]}: <span className="font-mono">{it.nettoKg.toLocaleString('id-ID')}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[9px] font-bold text-indigo-700">{s.productName || 'TBS'}</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-black text-indigo-950 whitespace-nowrap">
                    {s.ramNettoKg.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="text-slate-700">{s.shippingCost?.toLocaleString('id-ID') || 0}</span>
                      <span className="text-[8px] text-indigo-500 font-bold">M: {s.loadingCost?.toLocaleString('id-ID') || 0}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0 rounded uppercase ${
                        s.status === 'SELESAI_TERJUAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.status === 'SELESAI_TERJUAL' ? 'LUNAS' : 'OTW'}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {s.status !== 'SELESAI_TERJUAL' && (
                        <button
                          onClick={() => handleEdit(s)}
                          className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => setPrintShipment(s)}
                        className="p-1 rounded bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 transition-colors border border-slate-200"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.shipmentNumber)}
                        className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors border border-rose-200"
                        title="Hapus Surat Jalan"
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

      {/* Surat Jalan Print Modal with Itemized Multi-Commodity Breakdown */}
      {printShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                Surat Jalan Pengiriman Buah Kelapa Sawit
              </h3>
              <button
                onClick={() => setPrintShipment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-300 p-5 rounded-2xl font-mono text-xs space-y-3">
              <div className="text-center border-b pb-3 border-slate-200">
                <h4 className="font-bold text-base text-slate-900">RAM SUMBER REZEKI</h4>
                <p className="text-[10px] text-slate-500">SURAT JALAN PENGIRIMAN PKS</p>
                <p className="font-bold text-indigo-900 mt-1">
                  {printShipment.shipmentNumber}
                </p>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal:</span>
                  <span className="font-bold">{printShipment.date} {printShipment.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pabrik PKS Tujuan:</span>
                  <span className="font-bold text-indigo-900">{printShipment.factoryName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Sopir:</span>
                  <span className="font-bold">{printShipment.driverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Polisi Truk:</span>
                  <span className="font-bold">{printShipment.vehiclePlate}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-dashed mt-1">
                  <span className="text-slate-500 text-[10px]">Biaya Jalan:</span>
                  <span className="font-mono text-[10px]">
                    Ongkir: {printShipment.shippingCost?.toLocaleString('id-ID') || 0} | 
                    Muat: {printShipment.loadingCost?.toLocaleString('id-ID') || 0}
                  </span>
                </div>
              </div>

              {/* Multi-Commodity Breakdown Table */}
              <div className="pt-2">
                <span className="font-bold text-slate-700 block mb-1">
                  Rincian Komoditas Buah yang Dimuat:
                </span>
                <table className="w-full text-left border border-slate-300 text-[11px]">
                  <thead className="bg-slate-100 border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 border-r border-slate-300">No.</th>
                      <th className="p-1.5 border-r border-slate-300">Kategori Komoditas</th>
                      <th className="p-1.5 text-right">Berat (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printShipment.items && printShipment.items.length > 0 ? (
                      printShipment.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="p-1.5 border-r border-slate-300 text-center">{idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-300 font-bold">{it.productName}</td>
                          <td className="p-1.5 text-right font-black">{it.nettoKg.toLocaleString('id-ID')} kg</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-1.5 border-r border-slate-300 text-center">1</td>
                        <td className="p-1.5 border-r border-slate-300 font-bold">{printShipment.productName || 'TBS'}</td>
                        <td className="p-1.5 text-right font-black">{printShipment.ramNettoKg.toLocaleString('id-ID')} kg</td>
                      </tr>
                    )}
                    <tr className="bg-indigo-50 font-bold text-indigo-950">
                      <td colSpan={2} className="p-2 border-r border-slate-300 text-right">
                        TOTAL BERAT MUATAN TRUK:
                      </td>
                      <td className="p-2 text-right text-sm font-black">
                        {printShipment.ramNettoKg.toLocaleString('id-ID')} kg
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center pt-6 text-[10px]">
                <div>
                  <p className="mb-8 text-slate-500">Sopir Pengangkut</p>
                  <p className="font-bold border-t pt-1">( {printShipment.driverName} )</p>
                </div>
                <div>
                  <p className="mb-8 text-slate-500">Pengurus RAM</p>
                  <p className="font-bold border-t pt-1">( Pengurus RAM )</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPrintShipment(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
