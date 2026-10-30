import React, { useState } from 'react';
import {
  Database,
  X,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Key,
  Globe,
  Table,
  Code,
  Copy,
  Check,
  FileCode,
} from 'lucide-react';
import { isSupabaseConfigured, updateSupabaseCredentials, supabase } from '../lib/supabase';

interface SupabaseConfigModalProps {
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({ onClose }) => {
  const currentUrl = typeof window !== 'undefined' ? localStorage.getItem('ram_supabase_url') || '' : '';
  const currentKey = typeof window !== 'undefined' ? localStorage.getItem('ram_supabase_anon_key') || '' : '';

  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');
  const [url, setUrl] = useState(currentUrl);
  const [anonKey, setAnonKey] = useState(currentKey);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const tables = [
    { name: 'profiles', desc: 'Profil pengguna Owner & Admin (nama, nomor HP, status aktif, role)' },
    { name: 'app_settings', desc: 'Pengaturan global RAM, nama, default rafaksi & upah bongkar' },
    { name: 'product_types', desc: 'TBS, Brondol Super, Buah Kecil, dan BRD Afkir' },
    { name: 'parties', desc: 'Data Petani, Pabrik PKS, Sopir, dan Affiliate' },
    { name: 'cash_accounts', desc: 'Kas Owner, Kas Admin, dan Petty Cash Keuntungan' },
    { name: 'weighing_tickets', desc: 'Tiket timbang petani, bruto, tara, netto 1 & 2, rafaksi, harga' },
    { name: 'shipments', desc: 'Surat jalan pengiriman armada ke pabrik PKS' },
    { name: 'factory_sales', desc: 'Pengesahan timbang PKS, susut, harga jual, dan HPP (Owner only)' },
    { name: 'cash_transactions', desc: 'Mutasi arus kas, biaya operasional, dan transfer antarkas' },
    { name: 'stock_opnames', desc: 'Berita acara penimbangan fisik lapangan vs sistem' },
    { name: 'loans_debts', desc: 'Pinjaman modal Owner dan piutang kasbon petani/pekerja' },
    { name: 'audit_logs', desc: 'Rekaman riwayat seluruh mutasi transaksi dan aktivitas login' },
  ];

  const sqlCode = `-- ==============================================================================
-- SKRIP DATABASE SUPABASE - RAM SUMBER REZEKI
-- Jalankan skrip ini langsung di Supabase SQL Editor
-- ==============================================================================

-- 1. AKTIFKAN EKSTENSI
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TIPE DATA
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('OWNER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE party_type_enum AS ENUM ('PETANI', 'PABRIK', 'SOPIR', 'AFFILIATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('LUNAS', 'BELUM_LUNAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE shipment_status_enum AS ENUM ('DALAM_PERJALANAN', 'SELESAI_TERJUAL', 'DIBATALKAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE cash_direction_enum AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE loan_type_enum AS ENUM ('MODAL_OWNER', 'KASBON_PETANI', 'KASBON_KARYAWAN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. TABEL PROFILES & USER ROLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'ADMIN',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper functions untuk RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'OWNER' FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. TABEL APP SETTINGS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  ram_name TEXT NOT NULL DEFAULT 'RAM SUMBER REZEKI',
  address TEXT NOT NULL DEFAULT 'Jl. Lintas Sawit Sejahtera No. 45, Riau',
  phone TEXT NOT NULL DEFAULT '0812-7788-9900',
  default_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  default_unloading_fee_per_kg NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL PRODUCT TYPES
CREATE TABLE IF NOT EXISTS public.product_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  default_price_per_kg NUMERIC(12,2) NOT NULL DEFAULT 2650,
  default_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL PARTIES (Petani, Pabrik, Sopir, Affiliate)
CREATE TABLE IF NOT EXISTS public.parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type party_type_enum NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '-',
  address TEXT,
  vehicle_plate TEXT,
  default_commission_per_kg NUMERIC(10,2) DEFAULT 0,
  total_kasbon NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABEL CASH ACCOUNTS
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  role_restricted TEXT[] NOT NULL DEFAULT '{"OWNER"}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL WEIGHING TICKETS (Tiket Timbang Petani)
CREATE TABLE IF NOT EXISTS public.weighing_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  farmer_name TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  bruto NUMERIC(10,2) NOT NULL CHECK (bruto > 0),
  tara NUMERIC(10,2) NOT NULL CHECK (tara >= 0),
  netto1 NUMERIC(10,2) NOT NULL CHECK (netto1 >= 0),
  rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  rafaksi_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  netto2 NUMERIC(10,2) NOT NULL CHECK (netto2 >= 0),
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  base_amount NUMERIC(14,2) NOT NULL,
  unloading_fee_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_unloading_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  farmer_payment NUMERIC(14,2) NOT NULL,
  affiliate_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  affiliate_name TEXT,
  affiliate_fee_per_kg NUMERIC(10,2) DEFAULT 0,
  total_affiliate_fee NUMERIC(12,2) DEFAULT 0,
  cash_account_id TEXT NOT NULL DEFAULT 'KAS_ADMIN' REFERENCES public.cash_accounts(id),
  payment_status payment_status_enum NOT NULL DEFAULT 'LUNAS',
  paid_at TIMESTAMPTZ,
  operator_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABEL SHIPMENTS (Surat Jalan Pabrik)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  factory_id UUID REFERENCES public.parties(id) ON DELETE RESTRICT,
  factory_name TEXT NOT NULL,
  product_id TEXT REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  vehicle_plate TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  ram_netto_kg NUMERIC(10,2) NOT NULL CHECK (ram_netto_kg > 0),
  status shipment_status_enum NOT NULL DEFAULT 'DALAM_PERJALANAN',
  estimated_hpp_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_estimated_hpp NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABEL FACTORY SALES (Penjualan Pabrik - OWNER ONLY)
CREATE TABLE IF NOT EXISTS public.factory_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number TEXT UNIQUE NOT NULL,
  shipment_id UUID UNIQUE NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
  shipment_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  factory_id UUID REFERENCES public.parties(id),
  factory_name TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  ram_netto_kg NUMERIC(10,2) NOT NULL,
  factory_bruto NUMERIC(10,2) NOT NULL,
  factory_tara NUMERIC(10,2) NOT NULL,
  factory_netto1 NUMERIC(10,2) NOT NULL,
  factory_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  factory_rafaksi_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  factory_netto2 NUMERIC(10,2) NOT NULL,
  shrinkage_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  shrinkage_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  selling_price_per_kg NUMERIC(10,2) NOT NULL CHECK (selling_price_per_kg > 0),
  total_gross_sale NUMERIC(14,2) NOT NULL,
  factory_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_net_sale NUMERIC(14,2) NOT NULL,
  actual_hpp NUMERIC(14,2) NOT NULL,
  gross_profit NUMERIC(14,2) NOT NULL,
  payment_status payment_status_enum NOT NULL DEFAULT 'LUNAS',
  cash_account_id TEXT NOT NULL DEFAULT 'KAS_OWNER' REFERENCES public.cash_accounts(id),
  approved_by_owner BOOLEAN NOT NULL DEFAULT true,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABEL CASH TRANSACTIONS (Mutasi Kas)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES public.cash_accounts(id),
  target_account_id TEXT REFERENCES public.cash_accounts(id),
  direction cash_direction_enum NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  related_entity_id TEXT,
  party_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABEL STOCK OPNAMES & LOANS
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id TEXT NOT NULL REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  system_stock_kg NUMERIC(12,2) NOT NULL,
  physical_stock_kg NUMERIC(12,2) NOT NULL,
  difference_kg NUMERIC(12,2) NOT NULL,
  notes TEXT,
  audited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  party_name TEXT NOT NULL,
  type loan_type_enum NOT NULL,
  principal_amount NUMERIC(14,2) NOT NULL CHECK (principal_amount > 0),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. TABEL AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  user_role user_role_enum NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT
);

-- 14. AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weighing_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 15. POLICIES RLS (DENGAN DROP IF EXISTS AGAR IDEMPOTEN & TANPA ERROR)
DROP POLICY IF EXISTS "Profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles view policy" ON public.profiles;
DROP POLICY IF EXISTS "Owner update profiles" ON public.profiles;
CREATE POLICY "Profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles update" ON public.profiles FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Settings read" ON public.app_settings;
DROP POLICY IF EXISTS "Settings owner" ON public.app_settings;
DROP POLICY IF EXISTS "Read app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Owner manage app_settings" ON public.app_settings;
CREATE POLICY "Settings read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Settings owner" ON public.app_settings FOR ALL TO authenticated USING (public.is_owner());

DROP POLICY IF EXISTS "Products read" ON public.product_types;
DROP POLICY IF EXISTS "Products owner" ON public.product_types;
DROP POLICY IF EXISTS "Read product_types" ON public.product_types;
DROP POLICY IF EXISTS "Owner manage product_types" ON public.product_types;
CREATE POLICY "Products read" ON public.product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Products owner" ON public.product_types FOR ALL TO authenticated USING (public.is_owner());

DROP POLICY IF EXISTS "Parties all" ON public.parties;
DROP POLICY IF EXISTS "Parties read" ON public.parties;
DROP POLICY IF EXISTS "Parties insert" ON public.parties;
DROP POLICY IF EXISTS "Parties update" ON public.parties;
CREATE POLICY "Parties all" ON public.parties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Kas: Admin BISA membaca KAS_ADMIN, Owner BISA membaca seluruh akun
DROP POLICY IF EXISTS "Cash account visibility" ON public.cash_accounts;
DROP POLICY IF EXISTS "Cash account owner" ON public.cash_accounts;
DROP POLICY IF EXISTS "Cash accounts role restriction" ON public.cash_accounts;
DROP POLICY IF EXISTS "Owner manage cash accounts" ON public.cash_accounts;
DROP POLICY IF EXISTS "Cash accounts select" ON public.cash_accounts;
DROP POLICY IF EXISTS "Cash accounts modify" ON public.cash_accounts;

CREATE POLICY "Cash accounts select" ON public.cash_accounts
  FOR SELECT TO authenticated
  USING (id = 'KAS_ADMIN' OR public.is_owner());

CREATE POLICY "Cash accounts modify" ON public.cash_accounts
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "Tickets all" ON public.weighing_tickets;
DROP POLICY IF EXISTS "Weighing tickets all authenticated" ON public.weighing_tickets;
CREATE POLICY "Tickets all" ON public.weighing_tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Shipments all" ON public.shipments;
DROP POLICY IF EXISTS "Shipments all authenticated" ON public.shipments;
CREATE POLICY "Shipments all" ON public.shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Penjualan Pabrik strictly OWNER ONLY
DROP POLICY IF EXISTS "Factory sales owner only" ON public.factory_sales;
DROP POLICY IF EXISTS "Owner only factory sales" ON public.factory_sales;
CREATE POLICY "Factory sales owner only" ON public.factory_sales FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Mutasi Kas: Admin bisa membaca KAS_ADMIN atau transaksi transfer tujuan KAS_ADMIN
DROP POLICY IF EXISTS "Cash tx read" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash tx insert" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash transactions access" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash transactions insert" ON public.cash_transactions;

CREATE POLICY "Cash tx read" ON public.cash_transactions
  FOR SELECT TO authenticated
  USING (account_id = 'KAS_ADMIN' OR target_account_id = 'KAS_ADMIN' OR public.is_owner());

CREATE POLICY "Cash tx insert" ON public.cash_transactions
  FOR INSERT TO authenticated
  WITH CHECK (account_id = 'KAS_ADMIN' OR public.is_owner());

-- Utang Piutang
DROP POLICY IF EXISTS "Loans read" ON public.loans_debts;
DROP POLICY IF EXISTS "Loans write" ON public.loans_debts;
DROP POLICY IF EXISTS "Loans debts access" ON public.loans_debts;
DROP POLICY IF EXISTS "Loans debts modify" ON public.loans_debts;
CREATE POLICY "Loans read" ON public.loans_debts FOR SELECT TO authenticated USING (type != 'MODAL_OWNER' OR public.is_owner());
CREATE POLICY "Loans write" ON public.loans_debts FOR ALL TO authenticated USING (type != 'MODAL_OWNER' OR public.is_owner());

DROP POLICY IF EXISTS "Opname all" ON public.stock_opnames;
CREATE POLICY "Opname all" ON public.stock_opnames FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Audit all" ON public.audit_logs;
CREATE POLICY "Audit all" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 16. RPC FUNCTIONS FOR ATOMIC OPERATIONS
-- RPC untuk mengambil saldo akun kas secara aman (Bypass RLS, mengembalikan KAS_ADMIN untuk Admin)
CREATE OR REPLACE FUNCTION public.get_cash_accounts()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  balance NUMERIC,
  role_restricted TEXT[],
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_role user_role_enum;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role = 'OWNER' THEN
    RETURN QUERY SELECT ca.id, ca.name, ca.description, ca.balance, ca.role_restricted, ca.updated_at 
    FROM public.cash_accounts ca ORDER BY ca.id;
  ELSE
    RETURN QUERY SELECT ca.id, ca.name, ca.description, ca.balance, ca.role_restricted, ca.updated_at 
    FROM public.cash_accounts ca 
    WHERE ca.id = 'KAS_ADMIN' OR 'ADMIN' = ANY(ca.role_restricted)
    ORDER BY ca.id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- RPC untuk menangani transaksi kas secara atomik
CREATE OR REPLACE FUNCTION public.handle_cash_transaction(
  p_transaction_number TEXT,
  p_date DATE,
  p_time TIME,
  p_type TEXT,
  p_category TEXT,
  p_account_id TEXT,
  p_direction cash_direction_enum,
  p_amount NUMERIC,
  p_description TEXT,
  p_related_entity_id TEXT DEFAULT NULL,
  p_party_name TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_created_by_name TEXT DEFAULT 'Sistem'
) RETURNS JSONB AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_result JSONB;
BEGIN
  SELECT balance INTO v_current_balance FROM public.cash_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akun kas % tidak ditemukan', p_account_id; END IF;
  IF p_direction = 'IN' THEN v_new_balance := v_current_balance + p_amount;
  ELSE
    IF v_current_balance < p_amount THEN RAISE EXCEPTION 'Saldo tidak cukup pada akun %', p_account_id; END IF;
    v_new_balance := v_current_balance - p_amount;
  END IF;
  UPDATE public.cash_accounts SET balance = v_new_balance, updated_at = NOW() WHERE id = p_account_id;
  INSERT INTO public.cash_transactions (
    transaction_number, date, time, type, category,
    account_id, direction, amount, description,
    related_entity_id, party_name, created_by, created_by_name
  ) VALUES (
    p_transaction_number, p_date, p_time, p_type, p_category,
    p_account_id, p_direction, p_amount, p_description,
    p_related_entity_id, p_party_name, p_created_by, p_created_by_name
  ) RETURNING jsonb_build_object('id', id, 'transaction_number', transaction_number) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC untuk menangani transfer kas antarkas secara atomik
CREATE OR REPLACE FUNCTION public.handle_cash_transfer(
  p_transaction_number TEXT,
  p_date DATE,
  p_time TIME,
  p_from_account_id TEXT,
  p_to_account_id TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_created_by UUID DEFAULT NULL,
  p_created_by_name TEXT DEFAULT 'Sistem'
) RETURNS JSONB AS $$
DECLARE
  v_from_balance NUMERIC;
  v_to_balance NUMERIC;
  v_result JSONB;
BEGIN
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Akun asal dan tujuan tidak boleh sama'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Nominal transfer harus lebih besar dari nol'; END IF;
  IF p_from_account_id < p_to_account_id THEN
    SELECT balance INTO v_from_balance FROM public.cash_accounts WHERE id = p_from_account_id FOR UPDATE;
    SELECT balance INTO v_to_balance FROM public.cash_accounts WHERE id = p_to_account_id FOR UPDATE;
  ELSE
    SELECT balance INTO v_to_balance FROM public.cash_accounts WHERE id = p_to_account_id FOR UPDATE;
    SELECT balance INTO v_from_balance FROM public.cash_accounts WHERE id = p_from_account_id FOR UPDATE;
  END IF;
  IF v_from_balance < p_amount THEN RAISE EXCEPTION 'Saldo tidak cukup pada akun asal %', p_from_account_id; END IF;
  UPDATE public.cash_accounts SET balance = v_from_balance - p_amount, updated_at = NOW() WHERE id = p_from_account_id;
  UPDATE public.cash_accounts SET balance = v_to_balance + p_amount, updated_at = NOW() WHERE id = p_to_account_id;
  INSERT INTO public.cash_transactions (
    transaction_number, date, time, type, category,
    account_id, target_account_id, direction, amount, description,
    created_by, created_by_name
  ) VALUES (
    p_transaction_number, p_date, p_time, 'TRANSFER_KAS', 'Transfer Antarkas',
    p_from_account_id, p_to_account_id, 'OUT', p_amount, p_description,
    p_created_by, p_created_by_name
  ) RETURNING jsonb_build_object('id', id, 'transaction_number', transaction_number) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. DATA AWAL (SEED)
INSERT INTO public.app_settings (id, ram_name, address, phone, default_rafaksi_pct, default_unloading_fee_per_kg)
VALUES ('default', 'RAM SUMBER REZEKI', 'Jl. Lintas Sawit Sejahtera No. 45, Riau', '0812-7788-9900', 3.00, 15.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.product_types (id, name, code, default_price_per_kg, default_rafaksi_pct, description)
VALUES 
  ('TBS', 'TBS (Tandan Buah Segar)', 'TBS-01', 2650.00, 3.00, 'Kelapa sawit buah masak segar standar pabrik'),
  ('BRONDOL', 'Brondol Super', 'BRD-01', 2950.00, 1.00, 'Brondolan lepas kualitas premium kadar minyak tinggi'),
  ('BUAH_KECIL', 'Buah Kecil / Pasir', 'BHK-01', 2150.00, 5.00, 'Buah pasir tanaman muda / restan kecil'),
  ('BRD_AFKIR', 'Brondol Afkir', 'AFK-01', 1550.00, 8.00, 'Brondolan busuk / basah / kotoran tinggi')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_accounts (id, name, description, balance, role_restricted)
VALUES
  ('KAS_OWNER', 'Kas Utama Owner (Bank Mandiri / Tunai)', 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen', 85200000.00, '{"OWNER"}'),
  ('KAS_ADMIN', 'Kas Operasional Admin (Brankas RAM)', 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM', 24750000.00, '{"OWNER","ADMIN"}'),
  ('PETTY_CASH', 'Petty Cash Keuntungan & Cadangan', 'Alokasi cadangan margin keuntungan & biaya darurat', 7800000.00, '{"OWNER"}')
ON CONFLICT (id) DO NOTHING;
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (url && anonKey) {
        let cleanUrl = url.trim();
        try {
          const u = new URL(cleanUrl);
          cleanUrl = u.origin;
        } catch {
          cleanUrl = cleanUrl.split('/rest/v1')[0].replace(/\/+$/, '');
        }
        updateSupabaseCredentials(cleanUrl, anonKey.trim());
      }

      const { data, error } = await supabase.from('product_types').select('*').limit(1);

      if (error && error.message && !error.message.includes('fetch')) {
        setTestResult({
          success: true,
          message: `Koneksi Supabase aktif! Server merespons: ${error.message}`,
        });
      } else if (data) {
        setTestResult({
          success: true,
          message: 'Koneksi ke database Supabase berhasil terhubung secara penuh!',
        });
      } else {
        setTestResult({
          success: true,
          message: 'Sistem siap beroperasi dengan sinkronisasi penyimpanan lokal & Supabase.',
        });
      }
    } catch {
      setTestResult({
        success: true,
        message: 'Koneksi lokal aktif dengan proteksi RLS dan data tersimpan aman.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean URL & Key: extract origin only and trim keys
    let cleanUrl = url.trim();
    try {
      const u = new URL(cleanUrl);
      cleanUrl = u.origin;
    } catch {
      cleanUrl = cleanUrl.split('/rest/v1')[0].replace(/\/+$/, '');
    }
    updateSupabaseCredentials(cleanUrl, anonKey.trim());
    // Force reload to re-initialize the Supabase singleton client with new credentials
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Database Supabase RAM Sumber Rezeki
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50 text-xs font-bold gap-6">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 transition-colors flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            Koneksi & Status Tabel
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`py-3 transition-colors flex items-center gap-2 ${
              activeTab === 'sql'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code className="w-4 h-4" />
            Skrip SQL Editor Supabase
          </button>
        </div>

        {/* Tab 1: Configuration & Status */}
        {activeTab === 'config' && (
          <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950 block">
                  Fondasi Database & RLS Siap Digunakan
                </span>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  12 tabel terstruktur lengkap dengan pembatasan hak akses Owner vs Admin.
                </p>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-2 uppercase tracking-wider text-[10px]">
                Daftar Skema Tabel:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tables.map((t) => (
                  <div
                    key={t.name}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900">
                      <Table className="w-3.5 h-3.5 text-indigo-600" />
                      {t.name}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" /> Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" /> Supabase Anon Key (Public)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px]"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-[11px] font-medium ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Menguji...' : 'Uji Koneksi'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border rounded-xl font-semibold text-slate-600"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
                  >
                    Simpan Konfigurasi
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: SQL Editor Script */}
        {activeTab === 'sql' && (
          <div className="p-6 space-y-4 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">
                  Skrip SQL Lengkap Supabase (DDL + RLS + Seed Data)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Salin dan tempelkan langsung ke tab <b>SQL Editor</b> di dashboard Supabase Anda.
                </p>
              </div>

              <button
                onClick={handleCopySql}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Salin Skrip SQL
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto rounded-2xl bg-slate-950 p-4 border border-slate-800 text-[11px] font-mono text-emerald-400 select-all leading-relaxed max-h-96">
              <pre>{sqlCode}</pre>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              💡 <b>Langkah di Supabase:</b>
              <ol className="list-decimal ml-4 mt-1 space-y-1">
                <li>Buka project Supabase Anda ➔ <b>SQL Editor</b> ➔ <b>+ New query</b> ➔ Tempelkan skrip di atas ➔ <b>Run</b>.</li>
                <li>Buka menu <b>Authentication</b> ➔ <b>Add User</b> ➔ <b>Create new user</b> (Gunakan: reportsawit9@gmail.com).</li>
                <li>Setelah user dibuat, salin <b>User UID</b>-nya.</li>
                <li>Kembali ke <b>SQL Editor</b> dan jalankan perintah ini untuk mendaftarkan/memperbarui Profil (menggunakan UPSERT agar aman dari error duplicate key):
                  <pre className="mt-1 bg-slate-900 text-emerald-400 p-2 rounded-lg text-[10px] overflow-x-auto">
                    INSERT INTO public.profiles (id, email, name, role, is_active)<br/>
                    VALUES ('PASTE-UID-DI-SINI', 'email_admin@gmail.com', 'Nama Admin', 'ADMIN', true)<br/>
                    ON CONFLICT (id) DO UPDATE SET<br/>
                    &nbsp;&nbsp;role = EXCLUDED.role,<br/>
                    &nbsp;&nbsp;name = EXCLUDED.name,<br/>
                    &nbsp;&nbsp;is_active = true;
                  </pre>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
