export type UserRole = 'OWNER' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ProductTypeId = 'TBS' | 'BRONDOL' | 'BUAH_KECIL' | 'BRD_AFKIR' | (string & {});

export interface ProductType {
  id: ProductTypeId;
  name: string;
  code: string;
  defaultPricePerKg: number;
  defaultRafaksiPct: number;
  description: string;
}

export type PartyType = 'PETANI' | 'PABRIK' | 'SOPIR' | 'AFFILIATE';

export interface Party {
  id: string;
  type: PartyType;
  name: string;
  phone: string;
  address?: string;
  vehiclePlate?: string;
  defaultCommissionPerKg?: number; // for affiliate
  totalKasbon?: number; // outstanding debt/loan
  notes?: string;
  createdAt: string;
}

export interface WeighingTicket {
  id: string;
  ticketNumber: string; // e.g. TKP-20261026-001
  date: string;
  time: string;
  partyId: string;
  farmerName: string;
  vehiclePlate: string;
  productId: ProductTypeId;
  productName: string;
  
  // Weight Breakdown
  bruto: number; // kg
  tara: number; // kg
  netto1: number; // kg (Bruto - Tara)
  rafaksiPct: number; // %
  rafaksiKg: number; // kg (Netto 1 * % / 100)
  netto2: number; // kg (Netto 1 - Rafaksi)
  
  // Financial calculation
  pricePerKg: number; // Rp/kg
  baseAmount: number; // Netto 2 * pricePerKg
  unloadingFeePerKg: number; // Upah bongkar per kg
  totalUnloadingFee: number; // Total potongan upah bongkar
  farmerPayment: number; // baseAmount - totalUnloadingFee
  
  // Affiliate / Broker
  affiliateId?: string;
  affiliateName?: string;
  affiliateFeePerKg?: number;
  totalAffiliateFee?: number;
  
  // Status & payment
  cashAccountId: 'KAS_ADMIN' | 'KAS_OWNER';
  paymentStatus: 'LUNAS' | 'BELUM_LUNAS';
  paidAt?: string;
  
  createdBy: string;
  operatorName: string;
  notes?: string;
  createdAt: string;
}

export interface ShipmentItem {
  productId: ProductTypeId;
  productName: string;
  nettoKg: number;
  estimatedHppPerKg: number;
  subtotalEstimatedHpp: number;
}

export interface Shipment {
  id: string;
  shipmentNumber: string; // e.g. SJP-20261026-001 (Surat Jalan)
  date: string;
  time: string;
  factoryId: string;
  factoryName: string;
  items: ShipmentItem[]; // Komposisi muatan multi-komoditas dalam 1 truk
  productId?: ProductTypeId; // Primary / fallback
  productName: string; // Deskripsi komoditas muatan (e.g. "TBS, Brondol")
  vehiclePlate: string;
  driverName: string;
  driverPhone?: string;
  
  ramNettoKg: number; // Total Netto 1 seluruh komoditas yang dimuat di RAM
  
  status: 'DALAM_PERJALANAN' | 'SELESAI_TERJUAL' | 'DIBATALKAN';
  
  // Cost tracking
  estimatedHppPerKg: number;
  totalEstimatedHpp: number;
  shippingCost?: number; // Ongkos angkut truk
  loadingCost?: number; // Upah muat
  
  createdBy: string;
  createdAt: string;
}

export interface FactorySale {
  id: string;
  saleNumber: string; // e.g. FKS-20261026-001
  shipmentId: string;
  shipmentNumber: string;
  date: string;
  factoryId: string;
  factoryName: string;
  productId?: ProductTypeId;
  productName: string;
  items?: ShipmentItem[];
  
  // RAM Weights
  ramNettoKg: number;
  
  // Factory Weighbridge Results
  factoryBruto: number;
  factoryTara: number;
  factoryNetto1: number;
  factoryRafaksiPct: number;
  factoryRafaksiKg: number;
  factoryNetto2: number;
  
  // Shrinkage calculation (Susut)
  shrinkageKg: number; // ramNettoKg - factoryNetto1
  shrinkagePct: number; // (shrinkageKg / ramNettoKg) * 100
  
  // Selling & Revenue
  sellingPricePerKg: number; // Rp/kg
  totalGrossSale: number; // factoryNetto2 * sellingPricePerKg
  factoryDeductions: number; // potongan timbang pabrik lain bila ada
  totalNetSale: number; // Nilai bersih diterima
  
  // COGS & Profit
  actualHpp: number;
  loadingCost: number;
  shippingCost: number;
  grossProfit: number; // totalNetSale - (actualHpp + loadingCost + shippingCost)
  
  // Settlement
  paymentStatus: 'LUNAS' | 'TEMPO_PABRIK';
  cashAccountId?: 'KAS_OWNER';
  approvedByOwner: boolean;
  approvedAt?: string;
  approvedByName?: string;
  
  notes?: string;
  createdAt: string;
}

export interface CashAccount {
  id: 'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH';
  name: string;
  description: string;
  balance: number;
  roleRestricted: UserRole[]; // Which roles can view
}

export type TransactionType = 
  | 'PEMBELIAN_PETANI'
  | 'KOMISI_AFFILIATE'
  | 'PENJUALAN_PABRIK'
  | 'PENGELUARAN_OPERASIONAL'
  | 'TRANSFER_KAS'
  | 'PINJAMAN_MODAL_MASUK'
  | 'PENGEMBALIAN_MODAL'
  | 'KASBON_KELUAR'
  | 'ANGSURAN_KASBON'
  | 'PRIVE_OWNER';

export interface CashTransaction {
  id: string;
  transactionNumber: string;
  date: string;
  time: string;
  type: TransactionType;
  category: string;
  accountId: 'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH';
  targetAccountId?: 'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'; // for transfers
  direction: 'IN' | 'OUT';
  amount: number;
  description: string;
  relatedEntityId?: string; // e.g. ticketId, shipmentId, loanId
  partyName?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface CashReconciliationReport {
  accounts: CashAccount[];
  discrepancies: Array<{
    accountId: string;
    storedBalance: number;
    calculatedBalance: number;
    diff: number;
  }>;
  totalIn: number;
  totalOut: number;
  transactionCount: number;
  lastChecked: string;
  isSynchronized: boolean;
}

export interface StockOpname {
  id: string;
  date: string;
  productId: ProductTypeId;
  productName: string;
  systemStockKg: number;
  physicalStockKg: number;
  differenceKg: number; // physical - system
  notes: string;
  auditedBy: string;
  createdAt: string;
}

export interface LoanDebt {
  id: string;
  partyId?: string;
  partyName: string;
  type: 'MODAL_OWNER' | 'KASBON_PETANI' | 'KASBON_KARYAWAN';
  principalAmount: number;
  remainingAmount: number;
  date: string;
  dueDate?: string;
  status: 'AKTIF' | 'LUNAS';
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
}

export interface AppSettings {
  ramName: string;
  address: string;
  phone: string;
  defaultRafaksiPct: number;
  defaultUnloadingFeePerKg: number;
  ownerPin: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
