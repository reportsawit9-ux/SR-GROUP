import { supabase } from './supabase';
import {
  UserProfile,
  ProductType,
  Party,
  PartyType,
  WeighingTicket,
  Shipment,
  FactorySale,
  CashAccount,
  CashTransaction,
  CashReconciliationReport,
  StockOpname,
  LoanDebt,
  AuditLog,
  AppSettings,
  ProductTypeId,
} from '../types';

const isValidUuid = (id?: string) =>
  id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) : false;

class StorageService {
  private TRIAL_VERSION_KEY = 'ram_sr_trial_clean_v8_zero';

  constructor() {
    if (typeof window !== 'undefined') {
      const isClean = localStorage.getItem(this.TRIAL_VERSION_KEY);
      if (!isClean) {
        this.clearAllTrialDataSync();
      }
    }
  }

  // Synchronous local cleanup for instantaneous fresh zero state
  clearAllTrialDataSync(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('ram_sr_cash_transactions');
      localStorage.removeItem('ram_sr_loans_debts');
      localStorage.removeItem('ram_sr_weighing_tickets');
      localStorage.removeItem('ram_sr_shipments');
      localStorage.removeItem('ram_sr_factory_sales');
      localStorage.removeItem('ram_sr_stock_opnames');
      
      const zeroAccounts = [
        {
          id: 'KAS_OWNER',
          name: 'Kas Utama Owner (Bank Mandiri / Tunai)',
          description: 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen',
          balance: 0,
          roleRestricted: ['OWNER']
        },
        {
          id: 'KAS_ADMIN',
          name: 'Kas Operasional Admin (Brankas RAM)',
          description: 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM',
          balance: 0,
          roleRestricted: ['OWNER', 'ADMIN']
        },
        {
          id: 'PETTY_CASH',
          name: 'Petty Cash Keuntungan & Cadangan',
          description: 'Alokasi cadangan margin keuntungan & biaya darurat',
          balance: 0,
          roleRestricted: ['OWNER']
        }
      ];
      localStorage.setItem('ram_sr_cash_accounts', JSON.stringify(zeroAccounts));
      localStorage.setItem(this.TRIAL_VERSION_KEY, 'true');
    } catch (e) {
      console.error('Error during clearAllTrialDataSync:', e);
    }
  }

  // Session handling (still uses localStorage for speed, but auth is via Supabase)
  getCurrentUser(): UserProfile | null {
    const data = localStorage.getItem('ram_sr_current_user');
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: UserProfile | null): void {
    if (user) {
      localStorage.setItem('ram_sr_current_user', JSON.stringify(user));
      this.addAuditLog({
        action: 'LOGIN',
        entityType: 'USER_SESSION',
        entityId: user.id,
        details: `User logged in: ${user.name} (${user.role})`,
      });
    } else {
      localStorage.removeItem('ram_sr_current_user');
    }
  }

  // Products
  async getProducts(): Promise<ProductType[]> {
    const DEFAULT_PRODUCTS: ProductType[] = [
      {
        id: 'TBS',
        name: 'Tandan Buah Segar (TBS) Super',
        code: 'TBS',
        defaultPricePerKg: 2650,
        defaultRafaksiPct: 3.0,
        description: 'Tandan Buah Segar kelapa sawit Kualitas Utama / Super'
      },
      {
        id: 'BRONDOL',
        name: 'Brondolan Sawit Clean',
        code: 'BRONDOL',
        defaultPricePerKg: 2850,
        defaultRafaksiPct: 1.0,
        description: 'Brondolan sawit matang bersih tanpa sampah/tangkai'
      },
      {
        id: 'BUAH_KECIL',
        name: 'TBS Buah Kecil / Pasir',
        code: 'BUAH_KECIL',
        defaultPricePerKg: 2300,
        defaultRafaksiPct: 5.0,
        description: 'Tandan sawit ukuran kecil dari tanaman muda'
      },
      {
        id: 'BRD_AFKIR',
        name: 'Brondolan Afkir / Busuk',
        code: 'BRD_AFKIR',
        defaultPricePerKg: 1800,
        defaultRafaksiPct: 10.0,
        description: 'Brondolan kondisi kualitas rendah atau bercampur busuk'
      }
    ];

    const productMap = new Map<string, ProductType>();

    // 1. Seed defaults
    DEFAULT_PRODUCTS.forEach(p => productMap.set(p.id, p));

    // 2. Fetch from Supabase
    try {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        data.forEach(p => {
          productMap.set(p.id, {
            id: p.id,
            name: p.name,
            code: p.code,
            defaultPricePerKg: Number(p.default_price_per_kg) || 0,
            defaultRafaksiPct: Number(p.default_rafaksi_pct) || 0,
            description: p.description || ''
          });
        });
      } else if (error) {
        console.warn('[Storage] Error/RLS fetching product_types from Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('[Storage] getProducts Supabase error:', err);
    }

    // 3. Fetch from localStorage (local custom commodities)
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('ram_sr_products');
        if (local) {
          const parsed: ProductType[] = JSON.parse(local);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (p && p.id) {
                productMap.set(p.id, p);
              }
            });
          }
        }
      } catch (e) {
        console.warn('[Storage] Error reading local products from localStorage:', e);
      }
    }

    return Array.from(productMap.values());
  }

  async saveProduct(product: ProductType): Promise<boolean> {
    // 1. Save locally in localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('ram_sr_products');
        let currentProducts: ProductType[] = local ? JSON.parse(local) : [];
        if (!Array.isArray(currentProducts)) currentProducts = [];

        const existingIdx = currentProducts.findIndex(p => p.id === product.id);
        if (existingIdx >= 0) {
          currentProducts[existingIdx] = product;
        } else {
          currentProducts.push(product);
        }
        localStorage.setItem('ram_sr_products', JSON.stringify(currentProducts));
      } catch (e) {
        console.error('Error saving product to localStorage:', e);
      }
    }

    // 2. Sync to Supabase
    try {
      const { error } = await supabase
        .from('product_types')
        .upsert({
          id: product.id,
          name: product.name,
          code: product.code,
          default_price_per_kg: product.defaultPricePerKg,
          default_rafaksi_pct: product.defaultRafaksiPct,
          description: product.description
        });

      if (error) {
        if (error.code === '42501') {
          console.warn('[Storage] product_types RLS restricted. Product successfully saved in local storage.');
        } else {
          console.error('Error saving product to Supabase:', error);
        }
      }
    } catch (err) {
      console.warn('[Storage] saveProduct Supabase fallback:', err);
    }

    await this.addAuditLog({
      action: 'SAVE_PRODUCT',
      entityType: 'PRODUCT',
      entityId: product.id,
      details: `Komoditas ${product.name} (${product.code}) berhasil disimpan/diperbarui.`,
    });

    return true;
  }

  // Parties
  async getParties(type?: PartyType): Promise<Party[]> {
    const DEFAULT_PARTIES: Party[] = [
      {
        id: 'a1111111-1111-4111-8111-111111111111',
        type: 'PETANI',
        name: 'Kelompok Tani Sawit Makmur',
        phone: '0812-3456-7890',
        address: 'Kec. Tapung, Kampar, Riau',
        vehiclePlate: 'BM 8123 AB',
        totalKasbon: 0,
        notes: 'Petani anggota rutin KUD',
        createdAt: new Date().toISOString()
      },
      {
        id: 'b2222222-2222-4222-8222-222222222222',
        type: 'PABRIK',
        name: 'PT Sawit Sejahtera Utama (PKS)',
        phone: '0811-9876-5432',
        address: 'Kawasan Industri Sawit KM 12',
        notes: 'Penerima PKS Utama',
        createdAt: new Date().toISOString()
      },
      {
        id: 'c3333333-3333-4333-8333-333333333333',
        type: 'SOPIR',
        name: 'Budi Santoso (Colt Diesel)',
        phone: '0852-1122-3344',
        address: 'Desa Rimba Sekampung',
        vehiclePlate: 'BM 9011 CD',
        totalKasbon: 0,
        notes: 'Sopir langganan angkut PKS',
        createdAt: new Date().toISOString()
      }
    ];

    const partyMap = new Map<string, Party>();

    // 1. Seed defaults
    DEFAULT_PARTIES.forEach(p => partyMap.set(p.id, p));

    // 2. Fetch from Supabase
    try {
      let query = supabase.from('parties').select('*').order('name');
      if (type) query = query.eq('type', type);

      const { data, error } = await query;
      if (!error && data) {
        data.forEach(p => {
          partyMap.set(p.id, {
            id: p.id,
            type: p.type,
            name: p.name,
            phone: p.phone,
            address: p.address,
            vehiclePlate: p.vehicle_plate,
            defaultCommissionPerKg: p.default_commission_per_kg,
            totalKasbon: p.total_kasbon,
            notes: p.notes,
            createdAt: p.created_at
          });
        });
      } else if (error) {
        console.warn('[Storage] Error/RLS fetching parties from Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('[Storage] getParties Supabase error:', err);
    }

    // 3. Fetch from localStorage (local contacts)
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('ram_sr_parties');
        if (local) {
          const parsed: Party[] = JSON.parse(local);
          if (Array.isArray(parsed)) {
            parsed.forEach(p => {
              if (p && p.id) {
                partyMap.set(p.id, p);
              }
            });
          }
        }
      } catch (e) {
        console.warn('[Storage] Error reading local parties from localStorage:', e);
      }
    }

    const allParties = Array.from(partyMap.values());
    if (type) {
      return allParties.filter(p => p.type === type);
    }
    return allParties;
  }

  async addParty(party: Omit<Party, 'id' | 'createdAt'>): Promise<Party | null> {
    const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    let createdParty: Party = {
      id: generatedId,
      type: party.type,
      name: party.name,
      phone: party.phone || '-',
      address: party.address || '',
      vehiclePlate: party.vehiclePlate || '',
      defaultCommissionPerKg: party.defaultCommissionPerKg || 0,
      totalKasbon: 0,
      notes: party.notes || '',
      createdAt: nowIso,
    };

    // 1. Save locally in localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('ram_sr_parties');
        let currentParties: Party[] = local ? JSON.parse(local) : [];
        if (!Array.isArray(currentParties)) currentParties = [];

        const existingIdx = currentParties.findIndex(p => p.id === createdParty.id);
        if (existingIdx >= 0) {
          currentParties[existingIdx] = createdParty;
        } else {
          currentParties.push(createdParty);
        }
        localStorage.setItem('ram_sr_parties', JSON.stringify(currentParties));
      } catch (e) {
        console.error('Error saving party to localStorage:', e);
      }
    }

    // 2. Try inserting into Supabase
    try {
      const { data, error } = await supabase
        .from('parties')
        .insert({
          type: party.type,
          name: party.name,
          phone: party.phone,
          address: party.address,
          vehicle_plate: party.vehiclePlate,
          default_commission_per_kg: party.defaultCommissionPerKg,
          notes: party.notes
        })
        .select()
        .single();

      if (!error && data) {
        createdParty = {
          id: data.id,
          type: data.type,
          name: data.name,
          phone: data.phone,
          address: data.address,
          vehiclePlate: data.vehicle_plate,
          defaultCommissionPerKg: data.default_commission_per_kg,
          totalKasbon: data.total_kasbon || 0,
          notes: data.notes,
          createdAt: data.created_at
        };

        // Update localStorage with Supabase ID if returned
        if (typeof window !== 'undefined') {
          try {
            const local = localStorage.getItem('ram_sr_parties');
            let currentParties: Party[] = local ? JSON.parse(local) : [];
            if (Array.isArray(currentParties)) {
              const idx = currentParties.findIndex(p => p.id === generatedId);
              if (idx >= 0) {
                currentParties[idx] = createdParty;
                localStorage.setItem('ram_sr_parties', JSON.stringify(currentParties));
              }
            }
          } catch (e) {
            // ignore
          }
        }
      } else {
        if (error?.code === '42501') {
          console.warn('[Storage] parties insert RLS restricted. Contact saved locally.');
        } else {
          console.error('Error adding party to Supabase:', error);
        }
      }
    } catch (err) {
      console.warn('[Storage] addParty Supabase fallback:', err);
    }

    await this.addAuditLog({
      action: 'CREATE_PARTY',
      entityType: 'PARTY',
      entityId: createdParty.id,
      details: `Tambah kontak baru: ${createdParty.name} (${createdParty.type})`,
    });

    return createdParty;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      ramName: 'RAM SUMBER REZEKI',
      address: 'Jl. Lintas Sawit Sejahtera No. 45, Riau',
      phone: '0812-7788-9900',
      defaultRafaksiPct: 3.0,
      defaultUnloadingFeePerKg: 15,
      ownerPin: '123456'
    };

    // 1. Try reading from Supabase for fresh server settings
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (!error && data && data.ram_name) {
        const dbSettings: AppSettings = {
          ramName: data.ram_name,
          address: data.address || defaultSettings.address,
          phone: data.phone || defaultSettings.phone,
          defaultRafaksiPct: Number(data.default_rafaksi_pct) ?? defaultSettings.defaultRafaksiPct,
          defaultUnloadingFeePerKg: Number(data.default_unloading_fee_per_kg) ?? defaultSettings.defaultUnloadingFeePerKg,
          ownerPin: '123456'
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem('ram_sr_app_settings', JSON.stringify(dbSettings));
        }
        return dbSettings;
      }
    } catch (e) {
      console.warn('[Storage] getSettings Supabase fallback:', e);
    }

    // 2. Fallback to localStorage
    if (typeof window !== 'undefined') {
      const local = localStorage.getItem('ram_sr_app_settings');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed && parsed.ramName) return { ...defaultSettings, ...parsed };
        } catch (e) {
          // ignore
        }
      }
    }

    return defaultSettings;
  }

  async saveSettings(settings: AppSettings): Promise<boolean> {
    // 1. Save locally immediately
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ram_sr_app_settings', JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent('ram_settings_changed', { detail: settings }));
      } catch (e) {
        console.error('Error saving settings locally:', e);
      }
    }

    // 2. Sync to Supabase
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          id: 'default',
          ram_name: settings.ramName,
          address: settings.address,
          phone: settings.phone,
          default_rafaksi_pct: settings.defaultRafaksiPct,
          default_unloading_fee_per_kg: settings.defaultUnloadingFeePerKg,
          updated_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '42501') {
          console.warn('[Storage] app_settings RLS restricted (Owner access required). Local settings saved.');
        } else {
          console.warn('Error saving settings to Supabase (saved locally):', error);
        }
      }
    } catch (err) {
      console.warn('[Storage] saveSettings Supabase fallback:', err);
    }

    await this.addAuditLog({
      action: 'UPDATE_SETTINGS',
      entityType: 'SYSTEM',
      entityId: 'APP_SETTINGS',
      details: `Perubahan profil RAM: ${settings.ramName}, Alamat: ${settings.address}, Rafaksi: ${settings.defaultRafaksiPct}%, Upah Bongkar: Rp ${settings.defaultUnloadingFeePerKg}/kg`,
    });

    return true;
  }

  // Weighing Tickets
  private STORAGE_KEY_WEIGHING_TICKETS = 'ram_sr_weighing_tickets';

  private getLocalTickets(): WeighingTicket[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_WEIGHING_TICKETS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local tickets:', e);
      }
    }
    return [];
  }

  private saveLocalTicket(ticket: WeighingTicket): void {
    const existing = this.getLocalTickets();
    const filtered = existing.filter(t => t.id !== ticket.id);
    const updated = [ticket, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_WEIGHING_TICKETS, JSON.stringify(updated));
    }
  }

  private deleteLocalTicket(id: string): void {
    const existing = this.getLocalTickets();
    const updated = existing.filter(t => t.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_WEIGHING_TICKETS, JSON.stringify(updated));
    }
  }

  async getTickets(): Promise<WeighingTicket[]> {
    const localTickets = this.getLocalTickets();

    try {
      const { data, error } = await supabase
        .from('weighing_tickets')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (!error && data) {
        const dbTickets: WeighingTicket[] = data.map(t => ({
          id: t.id,
          ticketNumber: t.ticket_number,
          date: t.date,
          time: t.time,
          partyId: t.party_id,
          farmerName: t.farmer_name,
          vehiclePlate: t.vehicle_plate,
          productId: t.product_id,
          productName: t.product_name,
          bruto: Number(t.bruto) || 0,
          tara: Number(t.tara) || 0,
          netto1: Number(t.netto1) || 0,
          rafaksiPct: Number(t.rafaksi_pct) || 0,
          rafaksiKg: Number(t.rafaksi_kg) || 0,
          netto2: Number(t.netto2) || 0,
          pricePerKg: Number(t.price_per_kg) || 0,
          baseAmount: Number(t.base_amount) || 0,
          unloadingFeePerKg: Number(t.unloading_fee_per_kg) || 0,
          totalUnloadingFee: Number(t.total_unloading_fee) || 0,
          farmerPayment: Number(t.farmer_payment) || 0,
          affiliateId: t.affiliate_id,
          affiliateName: t.affiliate_name,
          affiliateFeePerKg: Number(t.affiliate_fee_per_kg) || 0,
          totalAffiliateFee: Number(t.total_affiliate_fee) || 0,
          cashAccountId: t.cash_account_id,
          paymentStatus: t.payment_status,
          paidAt: t.paid_at,
          operatorName: t.operator_name,
          notes: t.notes,
          createdBy: t.created_by || '',
          createdAt: t.created_at
        }));

        const ticketMap = new Map<string, WeighingTicket>();
        dbTickets.forEach(t => ticketMap.set(t.id, t));
        localTickets.forEach(t => {
          if (!ticketMap.has(t.id) && !dbTickets.some(dbT => dbT.ticketNumber === t.ticketNumber)) {
            ticketMap.set(t.id, t);
          }
        });

        return Array.from(ticketMap.values()).sort(
          (a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime()
        );
      }
    } catch (e) {
      console.warn('[Storage] getTickets fallback to local storage:', e);
    }

    return localTickets;
  }

  async generateTicketNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = today.replace(/-/g, '');
    const localTickets = this.getLocalTickets().filter(t => t.date === today);
    let count = localTickets.length;

    try {
      const { count: sbCount } = await supabase
        .from('weighing_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      if (sbCount !== null && sbCount !== undefined) {
        count = Math.max(count, sbCount);
      }
    } catch (e) {
      // ignore
    }

    let seq = count + 1;
    let candidate = `TKP-${dateStr}-${String(seq).padStart(3, '0')}`;
    while (localTickets.some(t => t.ticketNumber === candidate)) {
      seq++;
      candidate = `TKP-${dateStr}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  async addWeighingTicket(data: Omit<WeighingTicket, 'id' | 'createdAt'>): Promise<WeighingTicket | null> {
    const user = this.getCurrentUser();
    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'TKP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const ticket: WeighingTicket = {
      ...data,
      id: fallbackId,
      createdAt: new Date().toISOString()
    };

    // 1. Immediately save locally to prevent data loss
    this.saveLocalTicket(ticket);

    // 2. Sync to Supabase
    try {
      const { data: newTicketData, error } = await supabase
        .from('weighing_tickets')
        .insert({
          ticket_number: data.ticketNumber,
          date: data.date,
          time: data.time,
          party_id: isValidUuid(data.partyId) ? data.partyId : null,
          farmer_name: data.farmerName,
          vehicle_plate: data.vehiclePlate,
          product_id: data.productId,
          product_name: data.productName,
          bruto: data.bruto,
          tara: data.tara,
          netto1: data.netto1,
          rafaksi_pct: data.rafaksiPct,
          rafaksi_kg: data.rafaksiKg,
          netto2: data.netto2,
          price_per_kg: data.pricePerKg,
          base_amount: data.baseAmount,
          unloading_fee_per_kg: data.unloadingFeePerKg,
          total_unloading_fee: data.totalUnloadingFee,
          farmer_payment: data.farmerPayment,
          affiliate_id: isValidUuid(data.affiliateId) ? data.affiliateId : null,
          affiliate_name: data.affiliateName,
          affiliate_fee_per_kg: data.affiliateFeePerKg,
          total_affiliate_fee: data.totalAffiliateFee,
          cash_account_id: data.cashAccountId,
          payment_status: data.paymentStatus,
          paid_at: data.paymentStatus === 'LUNAS' ? new Date().toISOString() : null,
          operator_name: data.operatorName,
          notes: data.notes,
          created_by: isValidUuid(user?.id) ? user?.id : null
        })
        .select()
        .single();

      if (!error && newTicketData) {
        // Remove temporary fallback ID and update with actual DB record
        this.deleteLocalTicket(fallbackId);
        ticket.id = newTicketData.id;
        ticket.createdAt = newTicketData.created_at;
        this.saveLocalTicket(ticket);
      } else if (error) {
        console.warn('[Storage] Supabase addWeighingTicket warning (saved locally):', error.message || error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase addWeighingTicket error fallback:', err);
    }

    // If lunas, record cash transaction
    if (ticket.paymentStatus === 'LUNAS' && ticket.farmerPayment > 0) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: ticket.date,
        time: ticket.time,
        type: 'PEMBELIAN_PETANI',
        category: `Bayar TBS: ${ticket.farmerName}`,
        accountId: ticket.cashAccountId,
        direction: 'OUT',
        amount: ticket.farmerPayment,
        description: `Bayar buah tiket ${ticket.ticketNumber} (${ticket.netto2} kg @ Rp ${ticket.pricePerKg.toLocaleString('id-ID')})`,
        relatedEntityId: ticket.id,
        partyName: ticket.farmerName,
      });
    }

    // Commission
    if (ticket.totalAffiliateFee && ticket.totalAffiliateFee > 0 && ticket.affiliateName) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + (Date.now() + 1).toString().slice(-8),
        date: ticket.date,
        time: ticket.time,
        type: 'KOMISI_AFFILIATE',
        category: `Komisi Affiliate: ${ticket.affiliateName}`,
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: ticket.totalAffiliateFee,
        description: `Komisi timbang ${ticket.ticketNumber} (${ticket.netto2} kg)`,
        relatedEntityId: ticket.id,
        partyName: ticket.affiliateName,
      });
    }

    await this.addAuditLog({
      action: 'INPUT_TIMBANG',
      entityType: 'WEIGHING_TICKET',
      entityId: ticket.ticketNumber,
      details: `Input timbang petani: ${ticket.farmerName}, Netto 1: ${ticket.netto1} kg, Bayar: Rp ${ticket.farmerPayment.toLocaleString('id-ID')}`,
    });

    return ticket;
  }

  async updateWeighingTicket(id: string, data: Partial<WeighingTicket>): Promise<void> {
    const localTickets = this.getLocalTickets();
    const existingTicket = localTickets.find(t => t.id === id);
    if (existingTicket) {
      const updated: WeighingTicket = {
        ...existingTicket,
        ...data,
      };
      this.saveLocalTicket(updated);
    }

    try {
      const { data: oldTicket, error: fetchError } = await supabase
        .from('weighing_tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (!fetchError && oldTicket) {
        await supabase
          .from('weighing_tickets')
          .update({
            payment_status: data.paymentStatus,
            notes: data.notes,
          })
          .eq('id', id);

        // Handle payment status change to LUNAS
        if (oldTicket.payment_status === 'BELUM_LUNAS' && data.paymentStatus === 'LUNAS') {
          await this.addCashTransaction({
            transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
            date: oldTicket.date,
            time: oldTicket.time,
            type: 'PEMBELIAN_PETANI',
            category: `Pelunasan TBS Petani: ${oldTicket.farmer_name}`,
            accountId: oldTicket.cash_account_id,
            direction: 'OUT',
            amount: oldTicket.farmer_payment,
            description: `Pelunasan tiket ${oldTicket.ticket_number} (${oldTicket.netto2} kg)`,
            relatedEntityId: id,
            partyName: oldTicket.farmer_name,
          });
        }
      }
    } catch (e) {
      console.warn('[Storage] updateWeighingTicket Supabase fallback:', e);
    }

    await this.addAuditLog({
      action: 'UPDATE_TIMBANG',
      entityType: 'WEIGHING_TICKET',
      entityId: existingTicket?.ticketNumber || id,
      details: `Update status timbang ${existingTicket?.ticketNumber || id}`,
    });
  }

  async deleteWeighingTicket(id: string): Promise<void> {
    this.deleteLocalTicket(id);

    try {
      const { data } = await supabase
        .from('weighing_tickets')
        .delete()
        .eq('id', id)
        .select('ticket_number, farmer_name')
        .single();

      if (data) {
        await this.addAuditLog({
          action: 'DELETE_TIMBANG',
          entityType: 'WEIGHING_TICKET',
          entityId: data.ticket_number,
          details: `Hapus timbang ${data.ticket_number} an. ${data.farmer_name}`,
        });
      }
    } catch (e) {
      console.warn('[Storage] deleteWeighingTicket Supabase fallback:', e);
    }
  }

  // Shipments
  private STORAGE_KEY_SHIPMENTS = 'ram_sr_shipments';

  private getLocalShipments(): Shipment[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_SHIPMENTS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local shipments:', e);
      }
    }
    return [];
  }

  private saveLocalShipment(shipment: Shipment): void {
    const existing = this.getLocalShipments();
    const filtered = existing.filter(s => s.id !== shipment.id);
    const updated = [shipment, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_SHIPMENTS, JSON.stringify(updated));
    }
  }

  private deleteLocalShipment(id: string): void {
    const existing = this.getLocalShipments();
    const updated = existing.filter(s => s.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_SHIPMENTS, JSON.stringify(updated));
    }
  }

  async getShipments(): Promise<Shipment[]> {
    const localShipments = this.getLocalShipments();

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (!error && data) {
        const dbShipments: Shipment[] = data.map(s => ({
          id: s.id,
          shipmentNumber: s.shipment_number,
          date: s.date,
          time: s.time,
          factoryId: s.factory_id,
          factoryName: s.factory_name,
          productId: s.product_id,
          productName: s.product_name,
          items: s.items || [],
          vehiclePlate: s.vehicle_plate,
          driverName: s.driver_name,
          driverPhone: s.driver_phone,
          ramNettoKg: Number(s.ram_netto_kg) || 0,
          status: s.status,
          estimatedHppPerKg: Number(s.estimated_hpp_per_kg) || 0,
          totalEstimatedHpp: Number(s.total_estimated_hpp) || 0,
          shippingCost: Number(s.shipping_cost) || 0,
          loadingCost: 0,
          createdBy: s.created_by || '',
          createdAt: s.created_at
        }));

        const shipmentMap = new Map<string, Shipment>();
        dbShipments.forEach(s => shipmentMap.set(s.id, s));
        localShipments.forEach(s => {
          if (!shipmentMap.has(s.id) && !dbShipments.some(dbS => dbS.shipmentNumber === s.shipmentNumber)) {
            shipmentMap.set(s.id, s);
          }
        });

        return Array.from(shipmentMap.values()).sort(
          (a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime()
        );
      }
    } catch (e) {
      console.warn('[Storage] getShipments fallback to local storage:', e);
    }

    return localShipments;
  }

  async generateShipmentNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = today.replace(/-/g, '');
    const localShipments = this.getLocalShipments().filter(s => s.date === today);
    let count = localShipments.length;

    try {
      const { count: sbCount } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      if (sbCount !== null && sbCount !== undefined) {
        count = Math.max(count, sbCount);
      }
    } catch (e) {
      // ignore
    }

    let seq = count + 1;
    let candidate = `SJP-${dateStr}-${String(seq).padStart(3, '0')}`;
    while (localShipments.some(s => s.shipmentNumber === candidate)) {
      seq++;
      candidate = `SJP-${dateStr}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  async addShipment(data: Omit<Shipment, 'id' | 'createdAt'>): Promise<Shipment | null> {
    const user = this.getCurrentUser();
    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'SJP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const shipment: Shipment = {
      ...data,
      id: fallbackId,
      createdAt: new Date().toISOString()
    };

    // 1. Save locally immediately
    this.saveLocalShipment(shipment);

    // 2. Sync to Supabase
    try {
      const { data: newShpData, error } = await supabase
        .from('shipments')
        .insert({
          shipment_number: data.shipmentNumber,
          date: data.date,
          time: data.time,
          factory_id: isValidUuid(data.factoryId) ? data.factoryId : null,
          factory_name: data.factoryName,
          product_id: data.productId,
          product_name: data.productName,
          items: data.items,
          vehicle_plate: data.vehiclePlate,
          driver_name: data.driverName,
          driver_phone: data.driverPhone,
          ram_netto_kg: data.ramNettoKg,
          status: data.status,
          estimated_hpp_per_kg: data.estimatedHppPerKg,
          total_estimated_hpp: data.totalEstimatedHpp,
          shipping_cost: data.shippingCost,
          created_by: isValidUuid(user?.id) ? user?.id : null
        })
        .select()
        .single();

      if (!error && newShpData) {
        this.deleteLocalShipment(fallbackId);
        shipment.id = newShpData.id;
        shipment.createdAt = newShpData.created_at;
        this.saveLocalShipment(shipment);
      } else if (error) {
        console.warn('[Storage] Supabase addShipment warning (saved locally):', error.message || error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase addShipment error fallback:', err);
    }

    // Costs
    if (shipment.shippingCost && shipment.shippingCost > 0) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: shipment.date,
        time: shipment.time,
        type: 'PENGELUARAN_OPERASIONAL',
        category: 'Ongkos Angkut Truk PKS',
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: shipment.shippingCost,
        description: `Ongkir ${shipment.shipmentNumber} ke ${shipment.factoryName} (${shipment.vehiclePlate})`,
        relatedEntityId: shipment.id,
        partyName: shipment.driverName,
      });
    }

    await this.addAuditLog({
      action: 'INPUT_PENGIRIMAN',
      entityType: 'SHIPMENT',
      entityId: shipment.shipmentNumber,
      details: `Surat Jalan Pengiriman ke ${shipment.factoryName}, muatan: ${shipment.ramNettoKg} kg`,
    });

    return shipment;
  }

  async updateShipment(id: string, data: Partial<Shipment>): Promise<boolean> {
    const localShipments = this.getLocalShipments();
    const existing = localShipments.find(s => s.id === id);
    if (existing) {
      const updated: Shipment = {
        ...existing,
        ...data,
      };
      this.saveLocalShipment(updated);
    }

    const updateObj: any = {};
    if (data.shipmentNumber) updateObj.shipment_number = data.shipmentNumber;
    if (data.date) updateObj.date = data.date;
    if (data.time) updateObj.time = data.time;
    if (data.factoryId !== undefined) updateObj.factory_id = isValidUuid(data.factoryId) ? data.factoryId : null;
    if (data.factoryName) updateObj.factory_name = data.factoryName;
    if (data.productId) updateObj.product_id = data.productId;
    if (data.productName) updateObj.product_name = data.productName;
    if (data.items) updateObj.items = data.items;
    if (data.vehiclePlate) updateObj.vehicle_plate = data.vehiclePlate;
    if (data.driverName) updateObj.driver_name = data.driverName;
    if (data.driverPhone) updateObj.driver_phone = data.driverPhone;
    if (data.ramNettoKg !== undefined) updateObj.ram_netto_kg = data.ramNettoKg;
    if (data.status) updateObj.status = data.status;
    if (data.estimatedHppPerKg !== undefined) updateObj.estimated_hpp_per_kg = data.estimatedHppPerKg;
    if (data.totalEstimatedHpp !== undefined) updateObj.total_estimated_hpp = data.totalEstimatedHpp;
    if (data.shippingCost !== undefined) updateObj.shipping_cost = data.shippingCost;

    try {
      await supabase.from('shipments').update(updateObj).eq('id', id);
    } catch (e) {
      console.warn('[Storage] updateShipment Supabase fallback:', e);
    }

    await this.addAuditLog({
      action: 'UPDATE_PENGIRIMAN',
      entityType: 'SHIPMENT',
      entityId: existing?.shipmentNumber || id,
      details: `Update surat jalan ${existing?.shipmentNumber || id}`,
    });

    return true;
  }

  async deleteShipment(id: string): Promise<boolean> {
    this.deleteLocalShipment(id);

    try {
      await supabase.from('shipments').delete().eq('id', id);
    } catch (e) {
      console.warn('[Storage] deleteShipment Supabase fallback:', e);
    }

    return true;
  }

  // Cash Accounts Storage Keys & Helpers
  private STORAGE_KEY_CASH_ACCOUNTS = 'ram_sr_cash_accounts';
  private STORAGE_KEY_CASH_TRANSACTIONS = 'ram_sr_cash_transactions';
  private STORAGE_KEY_LOANS_DEBTS = 'ram_sr_loans_debts';

  private defaultAccountsMap: Record<string, CashAccount> = {
    KAS_OWNER: {
      id: 'KAS_OWNER',
      name: 'Kas Utama Owner (Bank Mandiri / Tunai)',
      description: 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen',
      balance: 0,
      roleRestricted: ['OWNER'],
    },
    KAS_ADMIN: {
      id: 'KAS_ADMIN',
      name: 'Kas Operasional Admin (Brankas RAM)',
      description: 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM',
      balance: 0,
      roleRestricted: ['OWNER', 'ADMIN'],
    },
    PETTY_CASH: {
      id: 'PETTY_CASH',
      name: 'Petty Cash Keuntungan & Cadangan',
      description: 'Alokasi cadangan margin keuntungan & biaya darurat',
      balance: 0,
      roleRestricted: ['OWNER'],
    },
  };

  private getLocalCashAccounts(): CashAccount[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_CASH_ACCOUNTS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local cash accounts:', e);
      }
    }
    const initial = Object.values(this.defaultAccountsMap);
    this.saveLocalCashAccounts(initial);
    return initial;
  }

  private saveLocalCashAccounts(accounts: CashAccount[]): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_CASH_ACCOUNTS, JSON.stringify(accounts));
    }
  }

  private getLocalCashTransactions(): CashTransaction[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_CASH_TRANSACTIONS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local cash transactions:', e);
      }
    }
    return [];
  }

  private saveLocalCashTransaction(tx: CashTransaction): void {
    const existing = this.getLocalCashTransactions();
    const filtered = existing.filter(t => t.id !== tx.id && t.transactionNumber !== tx.transactionNumber);
    const updated = [tx, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_CASH_TRANSACTIONS, JSON.stringify(updated));
    }
  }

  private updateLocalAccountBalance(accountId: string, amount: number, direction: 'IN' | 'OUT'): number {
    const accs = this.getLocalCashAccounts();
    let newBal = 0;
    let found = false;

    const updated = accs.map(a => {
      if (a.id === accountId) {
        found = true;
        newBal = direction === 'IN' ? Number(a.balance) + amount : Number(a.balance) - amount;
        return { ...a, balance: newBal };
      }
      return a;
    });

    if (!found) {
      const base = this.defaultAccountsMap[accountId] || {
        id: accountId as any,
        name: accountId,
        description: '',
        balance: 0,
        roleRestricted: ['OWNER']
      };
      newBal = direction === 'IN' ? base.balance + amount : base.balance - amount;
      updated.push({ ...base, balance: newBal });
    }

    this.saveLocalCashAccounts(updated);
    return newBal;
  }

  // Cash Accounts
  async getCashAccounts(): Promise<CashAccount[]> {
    const localAccs = this.getLocalCashAccounts();

    try {
      // 1. Try RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_cash_accounts');
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const finalAccounts = rpcData.map((a: any) => {
          const localAcc = localAccs.find(l => l.id === a.id);
          return {
            id: a.id as any,
            name: a.name || this.defaultAccountsMap[a.id]?.name || a.id,
            description: a.description || this.defaultAccountsMap[a.id]?.description || '',
            balance: localAcc ? Number(localAcc.balance) : (Number(a.balance) || 0),
            roleRestricted: Array.isArray(a.role_restricted)
              ? a.role_restricted
              : (a.id === 'KAS_OWNER' ? ['OWNER'] : ['OWNER', 'ADMIN'])
          };
        });

        this.saveLocalCashAccounts(finalAccounts);
        const user = this.getCurrentUser();
        if (user?.role === 'ADMIN') return finalAccounts.filter(a => a.id === 'KAS_ADMIN');
        return finalAccounts;
      }

      // 2. Try Direct Query
      const { data, error } = await supabase.from('cash_accounts').select('*').order('id');
      if (!error && data && data.length > 0) {
        const finalAccounts = data.map(a => {
          const localAcc = localAccs.find(l => l.id === a.id);
          return {
            id: a.id as any,
            name: a.name || this.defaultAccountsMap[a.id]?.name || a.id,
            description: a.description || this.defaultAccountsMap[a.id]?.description || '',
            balance: localAcc ? Number(localAcc.balance) : (Number(a.balance) || 0),
            roleRestricted: Array.isArray(a.role_restricted)
              ? a.role_restricted
              : (a.id === 'KAS_OWNER' ? ['OWNER'] : ['OWNER', 'ADMIN'])
          };
        });

        this.saveLocalCashAccounts(finalAccounts);
        const user = this.getCurrentUser();
        if (user?.role === 'ADMIN') return finalAccounts.filter(a => a.id === 'KAS_ADMIN');
        return finalAccounts;
      }
    } catch (e) {
      console.warn('[Storage] Fallback to local cash accounts:', e);
    }

    const user = this.getCurrentUser();
    if (user?.role === 'ADMIN') {
      return localAccs.filter(a => a.id === 'KAS_ADMIN');
    }
    return localAccs;
  }

  async getCashAccountById(id: string): Promise<CashAccount | null> {
    const accounts = await this.getCashAccounts();
    const found = accounts.find(a => a.id === id);
    if (found) return found;
    return this.defaultAccountsMap[id] || null;
  }

  async getCashTransactions(): Promise<CashTransaction[]> {
    const localTxs = this.getLocalCashTransactions();

    try {
      const { data, error } = await supabase
        .from('cash_transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

      if (!error && data) {
        const dbTxs: CashTransaction[] = data.map(t => ({
          id: t.id,
          transactionNumber: t.transaction_number,
          date: t.date,
          time: t.time,
          type: t.type,
          category: t.category,
          accountId: t.account_id as any,
          targetAccountId: t.target_account_id as any,
          direction: t.direction,
          amount: Number(t.amount) || 0,
          description: t.description,
          relatedEntityId: t.related_entity_id,
          partyName: t.party_name,
          createdBy: t.created_by,
          createdByName: t.created_by_name,
          createdAt: t.created_at
        }));

        const txMap = new Map<string, CashTransaction>();
        dbTxs.forEach(t => txMap.set(t.transactionNumber || t.id, t));
        localTxs.forEach(t => {
          if (!txMap.has(t.transactionNumber || t.id)) {
            txMap.set(t.transactionNumber || t.id, t);
          }
        });

        const merged = Array.from(txMap.values()).sort((a, b) => {
          return new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime();
        });

        return merged;
      }
    } catch (e) {
      console.warn('[Storage] Fetch cash transactions offline fallback:', e);
    }

    return localTxs;
  }

  async addCashTransaction(data: Omit<CashTransaction, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>): Promise<CashTransaction | null> {
    const user = this.getCurrentUser();

    // 1. Calculate new balance & update local storage cache immediately!
    const newBalance = this.updateLocalAccountBalance(data.accountId, data.amount, data.direction);

    // 2. Build local transaction object
    const tx: CashTransaction = {
      id: 'CTX-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      transactionNumber: data.transactionNumber,
      date: data.date,
      time: data.time,
      type: data.type,
      category: data.category,
      accountId: data.accountId,
      targetAccountId: data.targetAccountId,
      direction: data.direction,
      amount: data.amount,
      description: data.description,
      relatedEntityId: data.relatedEntityId,
      partyName: data.partyName,
      createdBy: user?.id || '',
      createdByName: user?.name || 'Sistem',
      createdAt: new Date().toISOString()
    };

    this.saveLocalCashTransaction(tx);

    // 3. Try Supabase RPC or direct table update
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('handle_cash_transaction', {
        p_transaction_number: data.transactionNumber,
        p_date: data.date,
        p_time: data.time,
        p_type: data.type,
        p_category: data.category,
        p_account_id: data.accountId,
        p_direction: data.direction,
        p_amount: data.amount,
        p_description: data.description,
        p_related_entity_id: data.relatedEntityId,
        p_party_name: data.partyName,
        p_created_by: user?.id,
        p_created_by_name: user?.name || 'Sistem'
      });

      if (rpcError) {
        await supabase.from('cash_transactions').insert({
          transaction_number: data.transactionNumber,
          date: data.date,
          time: data.time,
          type: data.type,
          category: data.category,
          account_id: data.accountId,
          target_account_id: data.targetAccountId,
          direction: data.direction,
          amount: data.amount,
          description: data.description,
          related_entity_id: data.relatedEntityId,
          party_name: data.partyName,
          created_by: user?.id,
          created_by_name: user?.name || 'Sistem'
        });

        await supabase.from('cash_accounts').update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        }).eq('id', data.accountId);
      } else if (rpcData?.id) {
        tx.id = rpcData.id;
      }
    } catch (err) {
      console.warn('[Storage] Supabase addCashTransaction sync fallback:', err);
    }

    await this.addAuditLog({
      action: 'MUTASI_KAS',
      entityType: 'CASH_TRANSACTION',
      entityId: tx.transactionNumber,
      details: `${tx.direction === 'IN' ? 'Pemasukan' : 'Pengeluaran'} ${tx.accountId}: Rp ${tx.amount.toLocaleString('id-ID')} (${tx.description})`,
    });

    return tx;
  }

  async transferCash(fromAccount: string, toAccount: string, amount: number, notes: string): Promise<void> {
    const user = this.getCurrentUser();
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const transactionNumber = 'TRF-' + Date.now().toString().slice(-8);

    // 1. Update local balances immediately
    const newFromBal = this.updateLocalAccountBalance(fromAccount, amount, 'OUT');
    const newToBal = this.updateLocalAccountBalance(toAccount, amount, 'IN');

    // 2. Save local transaction
    const tx: CashTransaction = {
      id: 'TRF-' + Date.now(),
      transactionNumber,
      date: today,
      time,
      type: 'TRANSFER_KAS',
      category: 'Transfer Antarkas',
      accountId: fromAccount as any,
      targetAccountId: toAccount as any,
      direction: 'OUT',
      amount,
      description: `Transfer ke ${toAccount}: ${notes}`,
      createdBy: user?.id || '',
      createdByName: user?.name || 'Sistem',
      createdAt: new Date().toISOString()
    };
    this.saveLocalCashTransaction(tx);

    // 3. Try Supabase
    try {
      const { error: rpcError } = await supabase.rpc('handle_cash_transfer', {
        p_transaction_number: transactionNumber,
        p_date: today,
        p_time: time,
        p_from_account_id: fromAccount,
        p_to_account_id: toAccount,
        p_amount: amount,
        p_description: `Transfer ke ${toAccount}: ${notes}`,
        p_created_by: user?.id,
        p_created_by_name: user?.name || 'Sistem'
      });

      if (rpcError) {
        await supabase.from('cash_transactions').insert({
          transaction_number: transactionNumber,
          date: today,
          time,
          type: 'TRANSFER_KAS',
          category: 'Transfer Antarkas',
          account_id: fromAccount,
          target_account_id: toAccount,
          direction: 'OUT',
          amount,
          description: `Transfer ke ${toAccount}: ${notes}`,
          created_by: user?.id,
          created_by_name: user?.name || 'Sistem'
        });

        await supabase.from('cash_accounts').update({ balance: newFromBal, updated_at: new Date().toISOString() }).eq('id', fromAccount);
        await supabase.from('cash_accounts').update({ balance: newToBal, updated_at: new Date().toISOString() }).eq('id', toAccount);
      }
    } catch (err) {
      console.warn('[Storage] Supabase transferCash sync warning:', err);
    }

    await this.addAuditLog({
      action: 'TRANSFER_KAS',
      entityType: 'CASH_TRANSACTION',
      entityId: transactionNumber,
      details: `Transfer dari ${fromAccount} ke ${toAccount}: Rp ${amount.toLocaleString('id-ID')} (${notes})`,
    });
  }

  // Automatic Cash Balances Reconciliation from Transaction History
  async reconcileCashBalances(): Promise<CashReconciliationReport> {
    const txs = await this.getCashTransactions();
    const currentAccounts = this.getLocalCashAccounts();
    const accountIds: Array<'KAS_OWNER' | 'KAS_ADMIN' | 'PETTY_CASH'> = ['KAS_OWNER', 'KAS_ADMIN', 'PETTY_CASH'];

    // Start from zero for genuine transaction-derived trial accounting
    const calculatedBalances: Record<string, number> = {
      KAS_OWNER: 0,
      KAS_ADMIN: 0,
      PETTY_CASH: 0,
    };

    let totalIn = 0;
    let totalOut = 0;

    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (t.direction === 'IN') {
        totalIn += amt;
        if (calculatedBalances[t.accountId] !== undefined) {
          calculatedBalances[t.accountId] += amt;
        }
      } else if (t.direction === 'OUT') {
        totalOut += amt;
        if (calculatedBalances[t.accountId] !== undefined) {
          calculatedBalances[t.accountId] -= amt;
        }
      }

      // Check incoming transfers: targetAccountId receives money when source accountId does OUT with TRANSFER_KAS
      if (t.type === 'TRANSFER_KAS' && t.targetAccountId) {
        if (calculatedBalances[t.targetAccountId] !== undefined) {
          calculatedBalances[t.targetAccountId] += amt;
        }
      }
    }

    const discrepancies: CashReconciliationReport['discrepancies'] = [];
    const updatedAccounts: CashAccount[] = accountIds.map(id => {
      const existing = currentAccounts.find(a => a.id === id) || this.defaultAccountsMap[id];
      const calcBal = calculatedBalances[id] ?? 0;
      const storedBal = Number(existing.balance) || 0;
      const diff = calcBal - storedBal;

      if (Math.abs(diff) > 0.01) {
        discrepancies.push({
          accountId: id,
          storedBalance: storedBal,
          calculatedBalance: calcBal,
          diff,
        });
      }

      return {
        ...existing,
        balance: calcBal,
      };
    });

    // Save accurate recomputed balances to local storage
    this.saveLocalCashAccounts(updatedAccounts);

    // Sync to Supabase cash_accounts table if available
    try {
      for (const acc of updatedAccounts) {
        await supabase
          .from('cash_accounts')
          .update({ balance: acc.balance, updated_at: new Date().toISOString() })
          .eq('id', acc.id);
      }
    } catch (e) {
      console.warn('[Storage] Supabase reconcile cash accounts sync fallback:', e);
    }

    return {
      accounts: updatedAccounts,
      discrepancies,
      totalIn,
      totalOut,
      transactionCount: txs.length,
      lastChecked: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      isSynchronized: discrepancies.length === 0,
    };
  }

  // Stock Calculation with Opname Adjustments and Multi-Commodity Loads
  async getStockSummary(): Promise<Record<string, { currentStockKg: number; inTransitKg: number; avgPurchasePrice: number; stockValue: number }>> {
    const products = await this.getProducts();
    const tickets = await this.getTickets();
    const shipments = await this.getShipments();
    const opnames = await this.getStockOpnames();
    const summary: Record<string, any> = {};

    for (const prod of products) {
      const prodTickets = tickets.filter(t => t.productId === prod.id);
      const totalInflow = prodTickets.reduce((acc, t) => acc + (Number(t.netto1) || 0), 0);
      const totalCost = prodTickets.reduce((acc, t) => acc + (Number(t.farmerPayment) || 0), 0);
      const avgPrice = totalInflow > 0 ? totalCost / totalInflow : prod.defaultPricePerKg;

      const totalShipped = shipments
        .filter(s => s.status !== 'DIBATALKAN')
        .reduce((acc, s) => {
          if (s.items && s.items.length > 0) {
            const match = s.items.find(it => it.productId === prod.id);
            return acc + (match ? (Number(match.nettoKg) || 0) : 0);
          }
          return acc + (s.productId === prod.id ? (Number(s.ramNettoKg) || 0) : 0);
        }, 0);
      
      const inTransit = shipments
        .filter(s => s.status === 'DALAM_PERJALANAN')
        .reduce((acc, s) => {
          if (s.items && s.items.length > 0) {
            const match = s.items.find(it => it.productId === prod.id);
            return acc + (match ? (Number(match.nettoKg) || 0) : 0);
          }
          return acc + (s.productId === prod.id ? (Number(s.ramNettoKg) || 0) : 0);
        }, 0);

      // Cumulative adjustments from physical stock opnames
      const prodOpnames = opnames.filter(o => o.productId === prod.id);
      const totalOpnameAdjustment = prodOpnames.reduce((acc, o) => acc + (Number(o.differenceKg) || 0), 0);

      // Stock physical is adjusted by cumulative opnames
      const currentStock = Math.max(0, totalInflow - totalShipped + totalOpnameAdjustment);

      summary[prod.id] = {
        currentStockKg: currentStock,
        inTransitKg: inTransit,
        avgPurchasePrice: avgPrice,
        stockValue: currentStock * avgPrice
      };
    }
    return summary;
  }

  // Factory Sales
  private STORAGE_KEY_FACTORY_SALES = 'ram_sr_factory_sales';

  private getLocalFactorySales(): FactorySale[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_FACTORY_SALES) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local factory sales:', e);
      }
    }
    return [];
  }

  private saveLocalFactorySale(sale: FactorySale): void {
    const existing = this.getLocalFactorySales();
    const filtered = existing.filter(s => s.id !== sale.id && s.saleNumber !== sale.saleNumber);
    const updated = [sale, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_FACTORY_SALES, JSON.stringify(updated));
    }
  }

  private deleteLocalFactorySale(id: string): void {
    const existing = this.getLocalFactorySales();
    const updated = existing.filter(s => s.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_FACTORY_SALES, JSON.stringify(updated));
    }
  }

  async getFactorySales(): Promise<FactorySale[]> {
    const localSales = this.getLocalFactorySales();

    try {
      const { data, error } = await supabase
        .from('factory_sales')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        const dbSales: FactorySale[] = data.map(s => ({
          id: s.id,
          saleNumber: s.sale_number,
          shipmentId: s.shipment_id || '',
          shipmentNumber: s.shipment_number || '',
          date: s.date,
          factoryId: s.factory_id || '',
          factoryName: s.factory_name || '',
          productId: s.product_id,
          productName: s.product_name || 'TBS',
          items: s.items || [],
          ramNettoKg: Number(s.ram_netto_kg) || 0,
          factoryBruto: Number(s.factory_bruto) || 0,
          factoryTara: Number(s.factory_tara) || 0,
          factoryNetto1: Number(s.factory_netto1) || 0,
          factoryRafaksiPct: Number(s.factory_rafaksi_pct) || 0,
          factoryRafaksiKg: Number(s.factory_rafaksi_kg) || 0,
          factoryNetto2: Number(s.factory_netto2) || 0,
          shrinkageKg: Number(s.shrinkage_kg) || 0,
          shrinkagePct: Number(s.shrinkage_pct) || 0,
          sellingPricePerKg: Number(s.selling_price_per_kg) || 0,
          totalGrossSale: Number(s.total_gross_sale) || 0,
          factoryDeductions: Number(s.factory_deductions) || 0,
          totalNetSale: Number(s.total_net_sale) || 0,
          actualHpp: Number(s.actual_hpp) || 0,
          grossProfit: Number(s.gross_profit) || 0,
          paymentStatus: s.payment_status || 'LUNAS',
          cashAccountId: (s.cash_account_id as any) || 'KAS_OWNER',
          loadingCost: Number(s.loading_cost) || 0,
          shippingCost: Number(s.shipping_cost) || 0,
          approvedByOwner: s.approved_by_owner ?? true,
          notes: s.notes || '',
          createdAt: s.created_at || new Date().toISOString()
        }));

        const saleMap = new Map<string, FactorySale>();
        dbSales.forEach(s => saleMap.set(s.id, s));
        localSales.forEach(s => {
          if (!saleMap.has(s.id) && !dbSales.some(dbS => dbS.saleNumber === s.saleNumber)) {
            saleMap.set(s.id, s);
          }
        });

        const merged = Array.from(saleMap.values()).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.STORAGE_KEY_FACTORY_SALES, JSON.stringify(merged));
        }
        return merged;
      }
    } catch (e) {
      console.warn('[Storage] getFactorySales fallback to local storage:', e);
    }

    return localSales;
  }

  async generateSaleNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const dateStr = today.replace(/-/g, '');
    const localSales = this.getLocalFactorySales().filter(s => s.date === today);
    let count = localSales.length;

    try {
      const { count: sbCount } = await supabase
        .from('factory_sales')
        .select('*', { count: 'exact', head: true })
        .eq('date', today);

      if (sbCount !== null && sbCount !== undefined) {
        count = Math.max(count, sbCount);
      }
    } catch (e) {
      // ignore
    }

    let seq = count + 1;
    let candidate = `FKS-${dateStr}-${String(seq).padStart(3, '0')}`;
    while (localSales.some(s => s.saleNumber === candidate)) {
      seq++;
      candidate = `FKS-${dateStr}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  }

  async addFactorySale(data: Omit<FactorySale, 'id' | 'createdAt'>): Promise<FactorySale | null> {
    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'FKS-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const sale: FactorySale = {
      ...data,
      id: fallbackId,
      createdAt: new Date().toISOString()
    };

    // 1. Save locally immediately
    this.saveLocalFactorySale(sale);

    // 2. If tied to a shipment, update shipment status to SELESAI_TERJUAL locally
    if (data.shipmentId) {
      const localShipments = this.getLocalShipments();
      const shp = localShipments.find(s => s.id === data.shipmentId || s.shipmentNumber === data.shipmentNumber);
      if (shp) {
        shp.status = 'SELESAI_TERJUAL';
        this.saveLocalShipment(shp);
      }
    }

    // 3. Sync to Supabase
    try {
      const { data: newSaleData, error } = await supabase
        .from('factory_sales')
        .insert({
          sale_number: data.saleNumber,
          shipment_id: isValidUuid(data.shipmentId) ? data.shipmentId : null,
          shipment_number: data.shipmentNumber,
          date: data.date,
          factory_id: isValidUuid(data.factoryId) ? data.factoryId : null,
          factory_name: data.factoryName,
          product_id: data.productId,
          product_name: data.productName,
          ram_netto_kg: data.ramNettoKg,
          factory_bruto: data.factoryBruto,
          factory_tara: data.factoryTara,
          factory_netto1: data.factoryNetto1,
          factory_rafaksi_pct: data.factoryRafaksiPct,
          factory_rafaksi_kg: data.factoryRafaksiKg,
          factory_netto2: data.factoryNetto2,
          shrinkage_kg: data.shrinkageKg,
          shrinkage_pct: data.shrinkagePct,
          selling_price_per_kg: data.sellingPricePerKg,
          total_gross_sale: data.totalGrossSale,
          factory_deductions: data.factoryDeductions,
          total_net_sale: data.totalNetSale,
          actual_hpp: data.actualHpp,
          gross_profit: data.grossProfit,
          payment_status: data.paymentStatus,
          cash_account_id: data.cashAccountId,
          loading_cost: data.loadingCost,
          shipping_cost: data.shippingCost,
          approved_by_owner: data.approvedByOwner,
          notes: data.notes
        })
        .select()
        .single();

      if (!error && newSaleData) {
        this.deleteLocalFactorySale(fallbackId);
        sale.id = newSaleData.id;
        sale.createdAt = newSaleData.created_at;
        this.saveLocalFactorySale(sale);
      } else if (error) {
        console.warn('[Storage] Supabase addFactorySale warning (saved locally):', error.message || error);
      }

      if (data.shipmentId && isValidUuid(data.shipmentId)) {
        await supabase.from('shipments').update({ status: 'SELESAI_TERJUAL' }).eq('id', data.shipmentId);
      }
    } catch (err) {
      console.warn('[Storage] addFactorySale Supabase fallback:', err);
    }

    // 4. Record cash transaction
    if (sale.approvedByOwner && sale.paymentStatus === 'LUNAS') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: sale.date,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'PENJUALAN_PABRIK',
        category: 'Hasil Penjualan PKS',
        accountId: 'KAS_OWNER',
        direction: 'IN',
        amount: sale.totalNetSale,
        description: `Pelunasan Penjualan ${sale.saleNumber} (${sale.factoryNetto2} kg) dari ${sale.factoryName}`,
        relatedEntityId: sale.id,
        partyName: sale.factoryName,
      });
    }

    await this.addAuditLog({
      action: 'SAHKAN_PENJUALAN',
      entityType: 'FACTORY_SALE',
      entityId: sale.saleNumber,
      details: `Pengesahan Penjualan Pabrik ${sale.factoryName}: ${sale.factoryNetto2} kg (Rp ${sale.totalNetSale.toLocaleString('id-ID')})`,
    });

    return sale;
  }

  async deleteFactorySale(id: string): Promise<boolean> {
    const localSales = this.getLocalFactorySales();
    const saleToDelete = localSales.find(s => s.id === id);

    // 1. Delete from local storage
    this.deleteLocalFactorySale(id);

    // 2. Revert shipment status back to DALAM_PERJALANAN if it was tied to a shipment
    if (saleToDelete?.shipmentId) {
      const localShipments = this.getLocalShipments();
      const shp = localShipments.find(s => s.id === saleToDelete.shipmentId || s.shipmentNumber === saleToDelete.shipmentNumber);
      if (shp) {
        shp.status = 'DALAM_PERJALANAN';
        this.saveLocalShipment(shp);
      }
      try {
        if (isValidUuid(saleToDelete.shipmentId)) {
          await supabase.from('shipments').update({ status: 'DALAM_PERJALANAN' }).eq('id', saleToDelete.shipmentId);
        }
      } catch (e) {
        console.warn('[Storage] revert shipment status fallback:', e);
      }
    }

    // 3. Delete from Supabase
    try {
      await supabase.from('factory_sales').delete().eq('id', id);
    } catch (e) {
      console.warn('[Storage] deleteFactorySale Supabase fallback:', e);
    }

    await this.addAuditLog({
      action: 'DELETE_PENJUALAN',
      entityType: 'FACTORY_SALE',
      entityId: saleToDelete?.saleNumber || id,
      details: `Hapus penjualan pabrik ${saleToDelete?.saleNumber || id}`,
    });

    return true;
  }

  // Audit Logs
  private STORAGE_KEY_AUDIT_LOGS = 'ram_sr_audit_logs';

  private getLocalAuditLogs(): AuditLog[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_AUDIT_LOGS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local audit logs:', e);
      }
    }
    return [];
  }

  private saveLocalAuditLog(log: AuditLog): void {
    const existing = this.getLocalAuditLogs();
    const updated = [log, ...existing].slice(0, 200);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_AUDIT_LOGS, JSON.stringify(updated));
    }
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const localLogs = this.getLocalAuditLogs();

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!error && data) {
        const dbLogs: AuditLog[] = data.map(l => ({
          id: l.id,
          timestamp: l.timestamp,
          userId: l.user_id,
          userName: l.user_name,
          userRole: l.user_role,
          action: l.action,
          entityType: l.entity_type,
          entityId: l.entity_id,
          details: l.details
        }));

        const logMap = new Map<string, AuditLog>();
        dbLogs.forEach(l => logMap.set(l.id, l));
        localLogs.forEach(l => {
          if (!logMap.has(l.id)) logMap.set(l.id, l);
        });

        return Array.from(logMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
    } catch (e) {
      console.warn('[Storage] getAuditLogs fallback to local logs:', e);
    }

    return localLogs;
  }

  async addAuditLog(entry: { action: string; entityType: string; entityId: string; details: string }): Promise<void> {
    const user = this.getCurrentUser();
    
    // Check if user.id is a valid UUID format before inserting to PostgreSQL
    const isValidUuid = (id?: string) =>
      id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) : false;

    const validUserId = isValidUuid(user?.id) ? user?.id : null;
    const nowIso = new Date().toISOString();

    const localLog: AuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: nowIso,
      userId: validUserId || '',
      userName: user?.name || 'Sistem',
      userRole: user?.role || 'ADMIN',
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details
    };

    // 1. Save locally immediately so no audit event is ever lost
    this.saveLocalAuditLog(localLog);

    // 2. Try inserting into Supabase
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: validUserId,
          user_name: user?.name || 'Sistem',
          user_role: user?.role || 'ADMIN',
          action: entry.action,
          entity_type: entry.entityType,
          entity_id: entry.entityId,
          details: entry.details
        });

      if (error) {
        if (error.code === '42501') {
          console.warn('[Storage] Audit log saved in local storage (Supabase RLS restricted).');
        } else {
          console.warn('[Storage] Audit log notice:', error.message || error);
        }
      }
    } catch (err) {
      console.warn('[Storage] addAuditLog Supabase sync warning:', err);
    }
  }

  // Loans
  private getLocalLoans(): LoanDebt[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_LOANS_DEBTS) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local loans:', e);
      }
    }
    return [];
  }

  private saveLocalLoan(loan: LoanDebt): void {
    const existing = this.getLocalLoans();
    const filtered = existing.filter(l => l.id !== loan.id);
    const updated = [loan, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_LOANS_DEBTS, JSON.stringify(updated));
    }
  }

  async getLoans(): Promise<LoanDebt[]> {
    const localLoans = this.getLocalLoans();

    try {
      const { data, error } = await supabase
        .from('loans_debts')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        const dbLoans = data.map(l => ({
          id: l.id,
          partyId: l.party_id,
          partyName: l.party_name,
          type: l.type,
          principalAmount: Number(l.principal_amount) || 0,
          remainingAmount: Number(l.remaining_amount) || 0,
          date: l.date,
          dueDate: l.due_date,
          status: l.status as any,
          notes: l.notes,
          createdAt: l.created_at
        }));

        const loanMap = new Map<string, LoanDebt>();
        dbLoans.forEach(l => loanMap.set(l.id, l));
        localLoans.forEach(l => {
          if (!loanMap.has(l.id)) loanMap.set(l.id, l);
        });

        return Array.from(loanMap.values());
      }
    } catch (e) {
      console.warn('[Storage] Fetch loans offline fallback:', e);
    }

    return localLoans;
  }

  async addLoan(data: Omit<LoanDebt, 'id' | 'createdAt'>): Promise<LoanDebt | null> {
    const loanId = 'LN-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const loan: LoanDebt = {
      ...data,
      id: loanId,
      createdAt: new Date().toISOString()
    };

    // Save locally
    this.saveLocalLoan(loan);

    try {
      const { data: newLoanData, error } = await supabase
        .from('loans_debts')
        .insert({
          party_id: isValidUuid(data.partyId) ? data.partyId : null,
          party_name: data.partyName,
          type: data.type,
          principal_amount: data.principalAmount,
          remaining_amount: data.remainingAmount,
          date: data.date,
          due_date: data.dueDate,
          status: data.status,
          notes: data.notes
        })
        .select()
        .single();

      if (!error && newLoanData) {
        loan.id = newLoanData.id;
        loan.createdAt = newLoanData.created_at;
        this.saveLocalLoan(loan);
      }
    } catch (e) {
      console.warn('[Storage] Supabase addLoan sync fallback:', e);
    }

    // Cash transactions - IMPORTANT: Updates cash account balance!
    if (loan.type === 'MODAL_OWNER') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: loan.date,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'PINJAMAN_MODAL_MASUK',
        category: 'Suntikan Modal Owner',
        accountId: 'KAS_OWNER',
        direction: 'IN',
        amount: loan.principalAmount,
        description: `Setoran modal kerja: ${loan.notes || ''}`,
      });
    } else if (loan.type === 'KASBON_PETANI' || loan.type === 'KASBON_KARYAWAN') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: loan.date,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'KASBON_KELUAR',
        category: 'Kasbon / Pinjaman Operasional',
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: loan.principalAmount,
        description: `Pencairan kasbon: ${loan.partyName}`,
        partyName: loan.partyName,
      });
    }

    return loan;
  }

  async recordLoanPayment(loanId: string, paymentAmount: number, notes?: string): Promise<void> {
    const loans = await this.getLoans();
    const foundLoan = loans.find(l => l.id === loanId);
    if (!foundLoan) return;

    const newRemaining = Math.max(0, foundLoan.remainingAmount - paymentAmount);
    const newStatus = newRemaining === 0 ? 'LUNAS' : 'AKTIF';

    const updatedLoan: LoanDebt = {
      ...foundLoan,
      remainingAmount: newRemaining,
      status: newStatus
    };
    this.saveLocalLoan(updatedLoan);

    try {
      await supabase
        .from('loans_debts')
        .update({ remaining_amount: newRemaining, status: newStatus })
        .eq('id', loanId);
    } catch (e) {
      console.warn('[Storage] Supabase recordLoanPayment sync fallback:', e);
    }

    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (foundLoan.type === 'MODAL_OWNER') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: today,
        time,
        type: 'PENGEMBALIAN_MODAL',
        category: 'Pengembalian Modal Owner',
        accountId: 'KAS_OWNER',
        direction: 'OUT',
        amount: paymentAmount,
        description: `Pengembalian pokok pinjaman modal ${foundLoan.partyName}: ${notes || ''}`,
      });
    } else {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: today,
        time,
        type: 'ANGSURAN_KASBON',
        category: 'Angsuran / Pelunasan Kasbon',
        accountId: 'KAS_ADMIN',
        direction: 'IN',
        amount: paymentAmount,
        description: `Pembayaran cicilan kasbon ${foundLoan.partyName}: ${notes || ''}`,
        partyName: foundLoan.partyName,
      });
    }
  }

  async deleteLoan(loanId: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem(this.STORAGE_KEY_LOANS_DEBTS);
        if (local) {
          const parsed: LoanDebt[] = JSON.parse(local);
          const filtered = parsed.filter(l => l.id !== loanId);
          localStorage.setItem(this.STORAGE_KEY_LOANS_DEBTS, JSON.stringify(filtered));
        }
      } catch (e) {
        console.error('Error deleting local loan:', e);
      }
    }

    try {
      await supabase.from('loans_debts').delete().eq('id', loanId);
    } catch (e) {
      console.warn('[Storage] Supabase deleteLoan sync fallback:', e);
    }

    await this.addAuditLog({
      action: 'DELETE_LOAN',
      entityType: 'LOAN_DEBT',
      entityId: loanId,
      details: `Hapus catatan pinjaman/kasbon ${loanId}`,
    });

    return true;
  }

  private STORAGE_KEY_STOCK_OPNAMES = 'ram_sr_stock_opnames';

  private getLocalStockOpnames(): StockOpname[] {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY_STOCK_OPNAMES) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error parsing local stock opnames:', e);
      }
    }
    return [];
  }

  private saveLocalStockOpname(opname: StockOpname): void {
    const existing = this.getLocalStockOpnames();
    const filtered = existing.filter(o => o.id !== opname.id);
    const updated = [opname, ...filtered];
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_STOCK_OPNAMES, JSON.stringify(updated));
    }
  }

  private deleteLocalStockOpname(id: string): void {
    const existing = this.getLocalStockOpnames();
    const updated = existing.filter(o => o.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY_STOCK_OPNAMES, JSON.stringify(updated));
    }
  }

  async getStockOpnames(): Promise<StockOpname[]> {
    const localOpnames = this.getLocalStockOpnames();

    try {
      const { data, error } = await supabase
        .from('stock_opnames')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const dbOpnames: StockOpname[] = data.map((o: any) => ({
          id: o.id,
          date: o.date,
          productId: o.product_id,
          productName: o.product_name,
          systemStockKg: Number(o.system_stock_kg) || 0,
          physicalStockKg: Number(o.physical_stock_kg) || 0,
          differenceKg: Number(o.difference_kg) || 0,
          notes: o.notes,
          auditedBy: o.audited_by,
          createdAt: o.created_at
        }));

        const opnameMap = new Map<string, StockOpname>();
        dbOpnames.forEach(o => opnameMap.set(o.id, o));
        localOpnames.forEach(o => {
          if (!opnameMap.has(o.id)) opnameMap.set(o.id, o);
        });

        return Array.from(opnameMap.values()).sort(
          (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        );
      }
    } catch (e) {
      console.warn('[Storage] getStockOpnames fallback to local storage:', e);
    }

    return localOpnames;
  }

  async addStockOpname(opname: Omit<StockOpname, 'id' | 'createdAt'>): Promise<StockOpname | null> {
    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'OPN-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const newOpname: StockOpname = {
      ...opname,
      id: fallbackId,
      createdAt: new Date().toISOString()
    };

    // 1. Save locally immediately
    this.saveLocalStockOpname(newOpname);

    // 2. Sync to Supabase
    try {
      const { data, error } = await supabase
        .from('stock_opnames')
        .insert({
          date: opname.date,
          product_id: opname.productId,
          product_name: opname.productName,
          system_stock_kg: opname.systemStockKg,
          physical_stock_kg: opname.physicalStockKg,
          difference_kg: opname.differenceKg,
          notes: opname.notes,
          audited_by: opname.auditedBy
        })
        .select()
        .single();

      if (!error && data) {
        this.deleteLocalStockOpname(fallbackId);
        newOpname.id = data.id;
        newOpname.createdAt = data.created_at;
        this.saveLocalStockOpname(newOpname);
      } else if (error) {
        console.warn('[Storage] Supabase addStockOpname warning (saved locally):', error.message || error);
      }
    } catch (err) {
      console.warn('[Storage] Supabase addStockOpname error fallback:', err);
    }

    await this.addAuditLog({
      action: 'STOCK_OPNAME',
      entityType: 'INVENTORY',
      entityId: newOpname.productId,
      details: `Stok opname ${newOpname.productName}: Sistem ${newOpname.systemStockKg} kg, Fisik ${newOpname.physicalStockKg} kg, Selisih ${newOpname.differenceKg > 0 ? '+' : ''}${newOpname.differenceKg} kg`,
    });

    return newOpname;
  }

  async deleteStockOpname(id: string): Promise<boolean> {
    this.deleteLocalStockOpname(id);

    try {
      await supabase.from('stock_opnames').delete().eq('id', id);
    } catch (e) {
      console.warn('[Storage] deleteStockOpname Supabase fallback:', e);
    }

    await this.addAuditLog({
      action: 'DELETE_STOCK_OPNAME',
      entityType: 'INVENTORY',
      entityId: id,
      details: `Hapus catatan stok opname ${id}`,
    });

    return true;
  }

  // Clear all trial data (transactions, tickets, shipments, sales, loans) and set balances to 0
  async clearAllTrialData(): Promise<void> {
    this.clearAllTrialDataSync();

    try {
      // Must delete in foreign key dependency order:
      // 1. factory_sales (references shipments)
      await supabase.from('factory_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 2. shipments
      await supabase.from('shipments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 3. weighing_tickets
      await supabase.from('weighing_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 4. cash_transactions
      await supabase.from('cash_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 5. stock_opnames
      await supabase.from('stock_opnames').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 6. loans_debts
      await supabase.from('loans_debts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // 7. Reset cash_accounts balances to 0
      await supabase.from('cash_accounts').update({ balance: 0, updated_at: new Date().toISOString() }).neq('id', '');
    } catch (e) {
      console.warn('[Storage] Clear Supabase trial data fallback:', e);
    }

    await this.addAuditLog({
      action: 'RESET_TRIAL_DATA',
      entityType: 'SYSTEM',
      entityId: 'ALL_DATA',
      details: 'Pengosongan seluruh data input transaksi untuk trial dari awal (saldo Rp 0).',
    });
  }

  async resetAllData(): Promise<void> {
    await this.clearAllTrialData();
  }
}

export const storage = new StorageService();
