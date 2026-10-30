# Rencana Revisi: Dashboard & Refaktor Tampilan Padat

Saya akan menghapus spanduk ucapan selamat datang di Dashboard dan melakukan refaktor pada seluruh tabel riwayat transaksi agar lebih padat (dense) sesuai dengan gaya "Arial Narrow".

## Langkah 1: Dashboard
- Menghapus komponen spanduk `flex flex-col sm:flex-row ...` di bagian atas `src/components/Dashboard.tsx`.
- Memindahkan tombol aksi cepat (Timbang & Kirim) ke bagian atas agar fungsionalitas tetap terjaga tanpa kotak ucapan yang besar.

## Langkah 2: Refaktor CSS (Font Padat)
- Menambahkan utility class khusus di `src/index.css` untuk mensimulasikan gaya "Arial Narrow" menggunakan `font-stretch` dan font condensed jika tersedia, atau mengatur `letter-spacing` agar teks lebih rapat.

## Langkah 3: Refaktor Tabel Transaksi
Saya akan memperbarui komponen berikut:
1. **WeighingSection**: Tabel riwayat timbang.
2. **PurchasesSection**: Tabel rekap pembelian.
3. **CashSection**: Tabel mutasi kas.
4. **ShipmentSection**: Tabel surat jalan.
5. **FactorySalesSection**: Tabel penjualan pabrik.
6. **AuditLogSection**: Tabel log aktivitas.
7. **LoansDebtsSection**: Tabel utang-piutang.

**Perubahan Teknis pada Tabel:**
- Mengurangi padding sel (`px-4 py-3` menjadi `px-2 py-1.5`).
- Menggunakan ukuran font yang lebih kecil (`text-[10px]` atau `text-[11px]`).
- Memastikan data dalam satu baris (single-row) tanpa pembungkus baris baru jika memungkinkan.
- Menerapkan gaya font padat pada seluruh konten tabel.
