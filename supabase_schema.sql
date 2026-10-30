-- ==============================================================================
-- SKRIP DATABASE SUPABASE - RAM SUMBER REZEKI
-- Manajemen Operasional & Keuangan Timbangan Kelapa Sawit
-- ==============================================================================
-- Skrip ini mencakup:
-- 1. Ekstensi UUID & Enums
-- 2. 7 Tabel Dasar (profiles, user_roles, app_settings, product_types, parties, cash_accounts, audit_logs)
-- 3. Tabel Transaksi (weighing_tickets, shipments, factory_sales, cash_transactions, stock_opnames, loans_debts)
-- 4. Keamanan Row Level Security (RLS) dengan pemisahan hak akses OWNER vs ADMIN
-- 5. Trigger updated_at otomatis & Seed Data Awal
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

-- 3. TABEL 1: PROFILES & USER ROLES
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

-- Helper function untuk memeriksa role pengguna saat ini di RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((SELECT role = 'OWNER' FROM public.profiles WHERE id = auth.uid()), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. TABEL 2: APP SETTINGS (Pengaturan RAM)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  ram_name TEXT NOT NULL DEFAULT 'RAM SUMBER REZEKI',
  address TEXT NOT NULL DEFAULT 'Jl. Lintas Sawit Sejahtera No. 45, Riau',
  phone TEXT NOT NULL DEFAULT '0812-7788-9900',
  default_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 3.00,
  default_unloading_fee_per_kg NUMERIC(10,2) NOT NULL DEFAULT 15.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABEL 3: PRODUCT TYPES (Komoditas Sawit)
CREATE TABLE IF NOT EXISTS public.product_types (
  id TEXT PRIMARY KEY, -- 'TBS', 'BRONDOL', 'BUAH_KECIL', 'BRD_AFKIR'
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  default_price_per_kg NUMERIC(12,2) NOT NULL DEFAULT 2500,
  default_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 3.0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABEL 4: PARTIES (Petani, Pabrik, Sopir, Affiliate)
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

-- 7. TABEL 5: CASH ACCOUNTS (Kas Owner, Kas Admin, Petty Cash)
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id TEXT PRIMARY KEY, -- 'KAS_OWNER', 'KAS_ADMIN', 'PETTY_CASH'
  name TEXT NOT NULL,
  description TEXT,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  role_restricted TEXT[] NOT NULL DEFAULT '{"OWNER"}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABEL 6: WEIGHING TICKETS (Tiket Timbang Petani)
CREATE TABLE IF NOT EXISTS public.weighing_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL, -- e.g. TKP-20261026-001
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  farmer_name TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  
  -- Rincian Timbangan
  bruto NUMERIC(10,2) NOT NULL CHECK (bruto > 0),
  tara NUMERIC(10,2) NOT NULL CHECK (tara >= 0),
  netto1 NUMERIC(10,2) NOT NULL CHECK (netto1 >= 0),
  rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  rafaksi_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  netto2 NUMERIC(10,2) NOT NULL CHECK (netto2 >= 0),
  
  -- Perhitungan Finansial
  price_per_kg NUMERIC(10,2) NOT NULL CHECK (price_per_kg >= 0),
  base_amount NUMERIC(14,2) NOT NULL,
  unloading_fee_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_unloading_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  farmer_payment NUMERIC(14,2) NOT NULL,
  
  -- Affiliate / Calo Buah
  affiliate_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  affiliate_name TEXT,
  affiliate_fee_per_kg NUMERIC(10,2) DEFAULT 0,
  total_affiliate_fee NUMERIC(12,2) DEFAULT 0,
  
  -- Status Pembayaran
  cash_account_id TEXT NOT NULL DEFAULT 'KAS_ADMIN' REFERENCES public.cash_accounts(id),
  payment_status payment_status_enum NOT NULL DEFAULT 'LUNAS',
  paid_at TIMESTAMPTZ,
  
  operator_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABEL 7: SHIPMENTS (Surat Jalan Pengiriman ke Pabrik PKS)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number TEXT UNIQUE NOT NULL, -- e.g. SJP-20261026-001
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  factory_id UUID REFERENCES public.parties(id) ON DELETE RESTRICT,
  factory_name TEXT NOT NULL,
  product_id TEXT REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb, -- Komposisi multi-komoditas dalam 1 truk (TBS, Brondol, Buah Kecil, BRD Afkir)
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

-- 10. TABEL 8: FACTORY SALES (Penjualan Pabrik - OWNER ONLY)
CREATE TABLE IF NOT EXISTS public.factory_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_number TEXT UNIQUE NOT NULL, -- e.g. FKS-20261026-001
  shipment_id UUID UNIQUE NOT NULL REFERENCES public.shipments(id) ON DELETE RESTRICT,
  shipment_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  factory_id UUID REFERENCES public.parties(id),
  factory_name TEXT NOT NULL,
  product_id TEXT REFERENCES public.product_types(id),
  product_name TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  
  ram_netto_kg NUMERIC(10,2) NOT NULL,
  
  -- Timbangan Sah Pabrik
  factory_bruto NUMERIC(10,2) NOT NULL,
  factory_tara NUMERIC(10,2) NOT NULL,
  factory_netto1 NUMERIC(10,2) NOT NULL,
  factory_rafaksi_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  factory_rafaksi_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  factory_netto2 NUMERIC(10,2) NOT NULL,
  
  -- Analisis Susut (Shrinkage)
  shrinkage_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  shrinkage_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  
  -- Penjualan & Margin
  selling_price_per_kg NUMERIC(10,2) NOT NULL CHECK (selling_price_per_kg > 0),
  total_gross_sale NUMERIC(14,2) NOT NULL,
  factory_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_net_sale NUMERIC(14,2) NOT NULL,
  
  -- Pengakuan HPP & Laba
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

-- 11. TABEL 9: CASH TRANSACTIONS (Mutasi Arus Kas)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_number TEXT UNIQUE NOT NULL, -- e.g. CTX-20261026-001
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES public.cash_accounts(id),
  target_account_id TEXT REFERENCES public.cash_accounts(id), -- jika transfer
  direction cash_direction_enum NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  related_entity_id TEXT,
  party_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABEL 10: STOCK OPNAMES (Berita Acara Opname Fisik)
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

-- 13. TABEL 11: LOANS & DEBTS (Utang Modal & Piutang Kasbon)
CREATE TABLE IF NOT EXISTS public.loans_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  party_name TEXT NOT NULL,
  type loan_type_enum NOT NULL,
  principal_amount NUMERIC(14,2) NOT NULL CHECK (principal_amount > 0),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'AKTIF', -- 'AKTIF' / 'LUNAS'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. TABEL 12: AUDIT LOGS (Catatan Jejak Aktivitas)
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

-- ==============================================================================
-- 15. KEAMANAN ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Aktifkan RLS di seluruh tabel
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

-- Kebijakan profiles: Pengguna bisa melihat, membuat, dan memperbarui profilnya sendiri atau Owner bisa mengelola semua
DROP POLICY IF EXISTS "Profiles view policy" ON public.profiles;
DROP POLICY IF EXISTS "Owner update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;

CREATE POLICY "Profiles view policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_owner());

CREATE POLICY "Profiles insert policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_owner());

CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_owner());

-- Kebijakan app_settings & product_types: Semua authenticated bisa baca, hanya owner bisa ubah
CREATE POLICY "Read app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manage app_settings" ON public.app_settings FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "Read product_types" ON public.product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner manage product_types" ON public.product_types FOR ALL TO authenticated USING (public.is_owner());

-- Kebijakan parties: Authenticated bisa membaca dan menambah kontak
CREATE POLICY "Parties read" ON public.parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Parties insert" ON public.parties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Parties update" ON public.parties FOR UPDATE TO authenticated USING (true);

-- Kebijakan cash_accounts:
-- ADMIN hanya bisa melihat KAS_ADMIN
-- OWNER bisa melihat semua akun kas
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

-- Kebijakan weighing_tickets & shipments:
-- Admin dan Owner bisa membaca, membuat, dan memperbarui
DROP POLICY IF EXISTS "Tickets all" ON public.weighing_tickets;
DROP POLICY IF EXISTS "Weighing tickets all authenticated" ON public.weighing_tickets;
CREATE POLICY "Weighing tickets all authenticated" ON public.weighing_tickets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Shipments all" ON public.shipments;
DROP POLICY IF EXISTS "Shipments all authenticated" ON public.shipments;
CREATE POLICY "Shipments all authenticated" ON public.shipments
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Kebijakan FACTORY_SALES (PENJUALAN PABRIK):
-- HANYA OWNER YANG BISA MELIHAT DAN MENGESAHKAN (ADMIN DIBLOKIR)
DROP POLICY IF EXISTS "Factory sales owner only" ON public.factory_sales;
DROP POLICY IF EXISTS "Owner only factory sales" ON public.factory_sales;
CREATE POLICY "Owner only factory sales" ON public.factory_sales
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- Kebijakan cash_transactions:
-- Admin hanya bisa melihat dan menambah transaksi KAS_ADMIN atau transfer yang ditujukan ke KAS_ADMIN
-- Owner bisa mengelola seluruh transaksi kas
DROP POLICY IF EXISTS "Cash tx read" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash tx insert" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash transactions access" ON public.cash_transactions;
DROP POLICY IF EXISTS "Cash transactions insert" ON public.cash_transactions;

CREATE POLICY "Cash transactions access" ON public.cash_transactions
  FOR SELECT TO authenticated
  USING (account_id = 'KAS_ADMIN' OR target_account_id = 'KAS_ADMIN' OR public.is_owner());

CREATE POLICY "Cash transactions insert" ON public.cash_transactions
  FOR INSERT TO authenticated
  WITH CHECK (account_id = 'KAS_ADMIN' OR public.is_owner());

-- RPC untuk mengambil daftar akun kas sesuai hak akses (Security Definer)
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

-- Kebijakan loans_debts:
DROP POLICY IF EXISTS "Loans debts access" ON public.loans_debts;
DROP POLICY IF EXISTS "Loans debts modify" ON public.loans_debts;

CREATE POLICY "Loans debts access" ON public.loans_debts
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Loans debts modify" ON public.loans_debts
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Kebijakan stock_opnames:
CREATE POLICY "Stock opnames view and create" ON public.stock_opnames
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Kebijakan audit_logs:
DROP POLICY IF EXISTS "Audit logs read" ON public.audit_logs;
DROP POLICY IF EXISTS "Audit logs insert" ON public.audit_logs;

CREATE POLICY "Audit logs read" ON public.audit_logs
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Audit logs insert" ON public.audit_logs
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- ==============================================================================
-- 15. RPC FUNCTIONS FOR ATOMIC OPERATIONS
-- ==============================================================================

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
  -- 1. Ambil saldo saat ini dengan lock untuk mencegah race condition
  SELECT balance INTO v_current_balance
  FROM public.cash_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Akun kas % tidak ditemukan', p_account_id;
  END IF;

  -- 2. Hitung saldo baru
  IF p_direction = 'IN' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSE
    -- Cek saldo cukup
    IF v_current_balance < p_amount THEN
      RAISE EXCEPTION 'Saldo tidak cukup pada akun %. Saldo: %, Diperlukan: %', p_account_id, v_current_balance, p_amount;
    END IF;
    v_new_balance := v_current_balance - p_amount;
  END IF;

  -- 3. Update saldo akun
  UPDATE public.cash_accounts
  SET balance = v_new_balance,
      updated_at = NOW()
  WHERE id = p_account_id;

  -- 4. Catat transaksi
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
  -- Validasi akun tidak sama
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Akun asal dan tujuan tidak boleh sama';
  END IF;

  -- Validasi nominal positif
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Nominal transfer harus lebih besar dari nol';
  END IF;

  -- 1. Lock kedua akun dalam urutan ID yang konsisten untuk menghindari deadlock
  IF p_from_account_id < p_to_account_id THEN
    SELECT balance INTO v_from_balance FROM public.cash_accounts WHERE id = p_from_account_id FOR UPDATE;
    SELECT balance INTO v_to_balance FROM public.cash_accounts WHERE id = p_to_account_id FOR UPDATE;
  ELSE
    SELECT balance INTO v_to_balance FROM public.cash_accounts WHERE id = p_to_account_id FOR UPDATE;
    SELECT balance INTO v_from_balance FROM public.cash_accounts WHERE id = p_from_account_id FOR UPDATE;
  END IF;

  -- 2. Cek saldo akun asal
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo tidak cukup pada akun asal %. Saldo: %, Diperlukan: %', p_from_account_id, v_from_balance, p_amount;
  END IF;

  -- 3. Update saldo kedua akun
  UPDATE public.cash_accounts SET balance = v_from_balance - p_amount, updated_at = NOW() WHERE id = p_from_account_id;
  UPDATE public.cash_accounts SET balance = v_to_balance + p_amount, updated_at = NOW() WHERE id = p_to_account_id;

  -- 4. Catat transaksi (sebagai pengeluaran dari akun asal dengan info target)
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

-- ==============================================================================
-- 16. DATA SEED AWAL (DEFAULT VALUES)
-- ==============================================================================

-- 1. App Settings
INSERT INTO public.app_settings (id, ram_name, address, phone, default_rafaksi_pct, default_unloading_fee_per_kg)
VALUES ('default', 'RAM SUMBER REZEKI', 'Jl. Lintas Sawit Sejahtera No. 45, Riau', '0812-7788-9900', 3.00, 15.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Master Jenis Produk
INSERT INTO public.product_types (id, name, code, default_price_per_kg, default_rafaksi_pct, description)
VALUES 
  ('TBS', 'TBS (Tandan Buah Segar)', 'TBS-01', 2650.00, 3.00, 'Kelapa sawit buah masak segar standar pabrik'),
  ('BRONDOL', 'Brondol Super', 'BRD-01', 2950.00, 1.00, 'Brondolan lepas kualitas premium kadar minyak tinggi'),
  ('BUAH_KECIL', 'Buah Kecil / Pasir', 'BHK-01', 2150.00, 5.00, 'Buah pasir tanaman muda / restan kecil'),
  ('BRD_AFKIR', 'Brondol Afkir', 'AFK-01', 1550.00, 8.00, 'Brondolan busuk / basah / kotoran tinggi')
ON CONFLICT (id) DO UPDATE SET
  default_price_per_kg = EXCLUDED.default_price_per_kg,
  default_rafaksi_pct = EXCLUDED.default_rafaksi_pct;

-- 3. Akun Kas Awal
INSERT INTO public.cash_accounts (id, name, description, balance, role_restricted)
VALUES
  ('KAS_OWNER', 'Kas Utama Owner (Bank Mandiri / Tunai)', 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen', 85200000.00, '{"OWNER"}'),
  ('KAS_ADMIN', 'Kas Operasional Admin (Brankas RAM)', 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM', 24750000.00, '{"OWNER","ADMIN"}'),
  ('PETTY_CASH', 'Petty Cash Keuntungan & Cadangan', 'Alokasi cadangan margin keuntungan & biaya darurat', 7800000.00, '{"OWNER"}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 4. Pihak / Kontak Awal (Petani, Pabrik PKS, Sopir, Affiliate)
INSERT INTO public.parties (type, name, phone, address, vehicle_plate, notes)
VALUES
  ('PETANI', 'Pak Joko Santoso', '0813-1122-3344', 'Desa Sukamaju Blok B', 'BK 8219 XL', 'Petani tetap 12 Ha'),
  ('PETANI', 'Pak Budi Utomo', '0812-4455-6677', 'Desa Makmur Jaya', 'BM 9410 AA', 'Petani mandiri'),
  ('PETANI', 'Pak Hendra Wijaya', '0821-7788-9900', 'Kec. Sawit Makmur', 'BK 8542 YY', 'Rutin timbang 2 hari sekali'),
  ('PABRIK', 'PKS PT Sawit Sejahtera Mandiri', '061-8899001', 'Kawasan Industri Sawit KM 14', NULL, 'Pembayaran tempo 3 hari kerja, potongan standar 2.5%'),
  ('PABRIK', 'PKS PT Palma Indo Perkasa', '061-7766554', 'Jalan Raya Lintas PKS KM 28', NULL, 'Harga premium untuk Brondol & TBS segar'),
  ('SOPIR', 'Pak Supriadi (Sopir Colt)', '0813-9090-1122', NULL, 'BK 9011 TM', 'Armada Colt Diesel 8-9 ton'),
  ('SOPIR', 'Pak Dedi Kurnia (Sopir Fuso)', '0822-4567-8910', NULL, 'BK 8734 KL', 'Armada Fuso Engkel 15-18 ton'),
  ('AFFILIATE', 'Bang Togar (Kolektor Rombongan)', '0852-3344-5566', NULL, NULL, 'Membawa petani kelompok tani Tani Makmur')
ON CONFLICT DO NOTHING;
