import React, { useState, useEffect } from 'react';
import {
  PackageCheck,
  Plus,
  RefreshCw,
  Scale,
  CheckCircle,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { ProductTypeId, StockOpname, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface InventorySectionProps {
  currentUser: UserProfile;
}

export const InventorySection: React.FC<InventorySectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [products, setProducts] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any>({});
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<ProductTypeId>('TBS');
  const [physicalWeight, setPhysicalWeight] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [p, s, o] = await Promise.all([
        storage.getProducts(),
        storage.getStockSummary(),
        storage.getStockOpnames(),
      ]);
      setProducts(p);
      setStockSummary(s);
      setOpnames(o);
    } catch (err) {
      console.error('Error refreshing inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  const handleOpenOpname = (pId: ProductTypeId) => {
    setSelectedProductId(pId);
    setPhysicalWeight(stockSummary[pId]?.currentStockKg || 0);
    setNotes('');
    setIsOpnameModalOpen(true);
  };

  const handleDeleteOpname = async (opname: StockOpname) => {
    if (!window.confirm(`Hapus catatan stok opname ${opname.productName} (${opname.date})? Stok sistem akan dikalkulasi ulang otomatis.`)) {
      return;
    }
    await storage.deleteStockOpname(opname.id);
    await refreshData();
  };

  const handleSaveOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const systemStock = stockSummary[selectedProductId]?.currentStockKg || 0;
      const physical = Number(physicalWeight) || 0;
      const diff = physical - systemStock;

      const prod = products.find((p) => p.id === selectedProductId);

      await storage.addStockOpname({
        date: new Date().toISOString().slice(0, 10),
        productId: selectedProductId,
        productName: prod ? prod.name : selectedProductId,
        systemStockKg: systemStock,
        physicalStockKg: physical,
        differenceKg: diff,
        notes,
        auditedBy: currentUser.name,
      });

      await refreshData();
      setIsOpnameModalOpen(false);
      alert('Hasil Stok Opname berhasil disimpan dan stok sistem disesuaikan!');
    } catch (err) {
      console.error('Error saving stock opname:', err);
      alert('Terjadi kesalahan saat menyimpan stok opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-indigo-600" />
            Persediaan Stok RAM & Stok Opname Fisik
          </h2>
          <p className="text-xs text-slate-500">
            Kuantitas stok real-time, barang dalam perjalanan, dan penyesuaian opname fisik
          </p>
        </div>

        <button
          onClick={() => handleOpenOpname('TBS')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Scale className="w-4 h-4" />
          Input Stok Opname Fisik
        </button>
      </div>

      {/* Product Stock Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {products.map((prod) => {
          const item = stockSummary[prod.id] || {
            currentStockKg: 0,
            inTransitKg: 0,
            avgPurchasePrice: prod.defaultPricePerKg,
            stockValue: 0,
          };

          return (
            <div
              key={prod.id}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {prod.code}
                  </span>
                  <button
                    onClick={() => handleOpenOpname(prod.id)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold"
                  >
                    Opname
                  </button>
                </div>

                <h3 className="font-extrabold text-slate-900 text-sm mt-2">
                  {prod.name}
                </h3>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  {prod.description}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500">Stok Fisik RAM:</span>
                    <span className="text-xl font-black font-mono text-slate-900">
                      {item.currentStockKg.toLocaleString('id-ID')}{' '}
                      <span className="text-xs font-semibold text-slate-400">kg</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500">Dalam Perjalanan (PKS):</span>
                    <span className="font-bold font-mono text-blue-700">
                      {item.inTransitKg.toLocaleString('id-ID')} kg
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500">HPP Rata-rata:</span>
                    <span className="font-semibold font-mono text-slate-700">
                      {formatRupiah(item.avgPurchasePrice)}/kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Value (Owner only view) */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-400">Nilai Aset Stok:</span>
                <span className="font-black font-mono text-indigo-900">
                  {isOwner ? formatRupiah(item.stockValue) : '*** (Akses Owner)'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Opname History Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Riwayat Berita Acara Stok Opname
            </h3>
            <p className="text-xs text-slate-500">
              Perbandingan timbangan fisik lapangan vs catatan sistem
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {opnames.length} Catatan Opname
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-1.5 px-3">Tanggal / Komoditas</th>
                <th className="py-1.5 px-3 text-right">Sistem (kg)</th>
                <th className="py-1.5 px-3 text-right">Fisik (kg)</th>
                <th className="py-1.5 px-3 text-right">Selisih</th>
                <th className="py-1.5 px-3">Auditor / Ket</th>
                <th className="py-1.5 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opnames.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Belum ada riwayat stok opname. Klik "Input Stok Opname Fisik" untuk mencatat.
                  </td>
                </tr>
              ) : (
                opnames.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                    <td className="py-1.5 px-3">
                      <div className="font-mono text-[9px] text-slate-400">{o.date}</div>
                      <div className="font-bold text-slate-800 leading-tight">{o.productName}</div>
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                      {o.systemStockKg.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-black text-slate-900">
                      {o.physicalStockKg.toLocaleString('id-ID')}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono font-black">
                      <span
                        className={
                          o.differenceKg < 0
                            ? 'text-rose-600'
                            : o.differenceKg > 0
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                        }
                      >
                        {o.differenceKg > 0 ? `+${o.differenceKg}` : o.differenceKg}
                      </span>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="font-bold text-slate-700 leading-tight text-[9px]">{o.auditedBy}</div>
                      <div className="text-[9px] text-slate-500 truncate max-w-[150px]">{o.notes || '-'}</div>
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        onClick={() => handleDeleteOpname(o)}
                        className="p-1 rounded text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                        title="Hapus Catatan Opname"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Opname Modal */}
      {isOpnameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveOpname}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-600" />
                Input Hasil Stok Opname Fisik
              </h3>
              <button
                type="button"
                onClick={() => setIsOpnameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Komoditas
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  const p = e.target.value as ProductTypeId;
                  setSelectedProductId(p);
                  setPhysicalWeight(stockSummary[p]?.currentStockKg || 0);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Stok Tercatat Sistem Saat Ini:</span>
                <span className="font-bold font-mono text-slate-900">
                  {(stockSummary[selectedProductId]?.currentStockKg || 0).toLocaleString(
                    'id-ID'
                  )}{' '}
                  kg
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hasil Timbangan Fisik Aktual (kg)
              </label>
              <input
                type="number"
                value={physicalWeight}
                onChange={(e) =>
                  setPhysicalWeight(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-sm font-mono font-black text-slate-900 border-2 border-indigo-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Keterangan / Alasan Selisih
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Penyesuaian susut cuaca / restan lapangan..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl h-20 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpnameModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan & Sesuaikan Stok</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
