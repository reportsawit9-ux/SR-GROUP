import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle, Scale, ShieldCheck } from 'lucide-react';
import { WeighingTicket, AppSettings } from '../types';
import { storage } from '../lib/storage';

interface TicketPrintModalProps {
  ticket: WeighingTicket;
  onClose: () => void;
}

export const TicketPrintModal: React.FC<TicketPrintModalProps> = ({ ticket, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>({
    ramName: 'RAM SUMBER REZEKI',
    address: 'Jl. Lintas Sawit Km. 12',
    phone: '0812-3456-7890',
    defaultRafaksiPct: 2,
    defaultUnloadingFeePerKg: 10,
    ownerPin: '123456'
  });

  useEffect(() => {
    storage.getSettings().then((s) => {
      if (s) setSettings(s);
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Controls (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              Cetak Tiket Timbang Petani
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Slip Area */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 text-xs font-mono printable-slip">
          {/* Slip Header */}
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Scale className="w-5 h-5 text-indigo-700" />
              <h2 className="text-base font-extrabold tracking-wider uppercase text-slate-900">
                {settings.ramName}
              </h2>
            </div>
            <p className="text-[11px] text-slate-600 leading-tight">
              {settings.address}
            </p>
            <p className="text-[11px] text-slate-600">
              Telp / WA: {settings.phone}
            </p>
            <div className="mt-2 inline-block px-3 py-0.5 bg-slate-100 rounded text-[11px] font-bold tracking-widest text-slate-800 border border-slate-200">
              BUKTI PENIMBANGAN KELAPA SAWIT
            </div>
          </div>

          {/* Ticket Metadata */}
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-dashed border-slate-300 text-[11px]">
            <div>
              <span className="text-slate-500">No. Tiket:</span>
              <p className="font-bold text-slate-900 text-xs">{ticket.ticketNumber}</p>
            </div>
            <div>
              <span className="text-slate-500">Waktu / Tanggal:</span>
              <p className="font-semibold text-slate-900">
                {ticket.date} • {ticket.time} WIB
              </p>
            </div>
            <div>
              <span className="text-slate-500">Nama Petani / Vendor:</span>
              <p className="font-bold text-slate-900">{ticket.farmerName}</p>
            </div>
            <div>
              <span className="text-slate-500">Nomor Kendaraan:</span>
              <p className="font-bold text-slate-900 uppercase">
                {ticket.vehiclePlate || '-'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Jenis Komoditas:</span>
              <p className="font-bold text-indigo-900">{ticket.productName}</p>
            </div>
            <div>
              <span className="text-slate-500">Status Pembayaran:</span>
              <p className="font-bold text-emerald-700">
                {ticket.paymentStatus === 'LUNAS' ? 'LUNAS (KAS ADMIN)' : 'BELUM DIBAYAR'}
              </p>
            </div>
          </div>

          {/* Weight Calculation Table */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span>Berat Bruto (Kotor):</span>
              <span className="font-bold text-slate-900">
                {ticket.bruto.toLocaleString('id-ID')} kg
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Berat Tara (Kendaraan Kosong):</span>
              <span className="font-bold text-slate-900">
                - {ticket.tara.toLocaleString('id-ID')} kg
              </span>
            </div>
            <div className="flex justify-between items-center font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded">
              <span>Netto 1 (Bruto - Tara):</span>
              <span className="text-indigo-900">
                {ticket.netto1.toLocaleString('id-ID')} kg
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>
                Potongan Rafaksi ({ticket.rafaksiPct}%):
              </span>
              <span className="font-semibold text-rose-600">
                - {ticket.rafaksiKg.toLocaleString('id-ID')} kg
              </span>
            </div>
            <div className="flex justify-between items-center font-extrabold text-sm text-slate-900 bg-indigo-50/60 px-2 py-1.5 rounded border border-indigo-100">
              <span>Netto 2 (Bersih Timbang):</span>
              <span className="text-indigo-700 font-black">
                {ticket.netto2.toLocaleString('id-ID')} kg
              </span>
            </div>
          </div>

          {/* Pricing & Net Calculation */}
          <div className="py-3 border-b-2 border-dashed border-slate-300 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span>Harga Beli per kg:</span>
              <span className="font-bold text-slate-900">
                {formatRupiah(ticket.pricePerKg)} / kg
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Nilai Dasar (Netto 2 x Harga):</span>
              <span className="font-semibold text-slate-900">
                {formatRupiah(ticket.baseAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>
                Upah Bongkar ({formatRupiah(ticket.unloadingFeePerKg)}/kg):
              </span>
              <span className="font-semibold text-rose-600">
                - {formatRupiah(ticket.totalUnloadingFee)}
              </span>
            </div>
            {ticket.totalAffiliateFee && ticket.totalAffiliateFee > 0 ? (
              <div className="flex justify-between items-center text-[11px] text-slate-500 italic">
                <span>Komisi Rombongan ({ticket.affiliateName}):</span>
                <span>{formatRupiah(ticket.totalAffiliateFee)} (Terpisah)</span>
              </div>
            ) : null}

            {/* Total Payment to Farmer */}
            <div className="pt-2">
              <div className="flex justify-between items-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Total Diterima Petani
                  </span>
                  <p className="text-[10px] text-emerald-600">
                    Netto 2 x Harga - Upah Bongkar
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatRupiah(ticket.farmerPayment)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes if any */}
          {ticket.notes && (
            <div className="py-2 text-[11px] text-slate-500 border-b border-dashed border-slate-200">
              <span className="font-semibold">Catatan:</span> {ticket.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-4 text-center pt-6 text-[11px]">
            <div>
              <p className="text-slate-500 mb-10">Petani / Supir Pengantar</p>
              <p className="font-bold text-slate-800 border-t border-slate-400 pt-1">
                ( {ticket.farmerName} )
              </p>
            </div>
            <div>
              <p className="text-slate-500 mb-10">Operator Timbangan RAM</p>
              <p className="font-bold text-slate-800 border-t border-slate-400 pt-1">
                ( {ticket.operatorName || 'Siti Rahma'} )
              </p>
            </div>
          </div>

          {/* Verification Hash / Footer */}
          <div className="text-center pt-5 text-[10px] text-slate-400">
            <p>Terima kasih atas kerja samanya • RAM SUMBER REZEKI</p>
            <p className="font-mono text-[9px] text-slate-300 mt-0.5">
              AUTHO-{ticket.ticketNumber}-VERIFIED
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="print:hidden p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 text-xs font-semibold"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Cetak Nota Timbang
          </button>
        </div>
      </div>
    </div>
  );
};
