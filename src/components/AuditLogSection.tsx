import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, User, Clock, AlertTriangle } from 'lucide-react';
import { storage } from '../lib/storage';
import { AuditLog, UserProfile } from '../types';

interface AuditLogSectionProps {
  currentUser: UserProfile;
}

export const AuditLogSection: React.FC<AuditLogSectionProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    storage.getAuditLogs().then(setLogs);
  }, []);

  const filtered = logs.filter((log) => {
    const matchSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || log.userRole === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Audit Trail & Log Aktivitas Sistem
          </h2>
          <p className="text-xs text-slate-500">
            Pencatatan setiap aksi timbang, kas, pengiriman, penjualan, dan login pengguna untuk transparansi dan audit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
          >
            <option value="ALL">Semua Peran (Role)</option>
            <option value="OWNER">Hanya Owner</option>
            <option value="ADMIN">Hanya Admin</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aksi, user, nomor tiket/faktur..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            {filtered.length} Catatan Log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
              <tr>
                <th className="py-1.5 px-3">Waktu / Pengguna</th>
                <th className="py-1.5 px-3">Aksi Sistem</th>
                <th className="py-1.5 px-3">Entitas ID</th>
                <th className="py-1.5 px-3">Rincian Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                  <td className="py-1.5 px-3">
                    <div className="font-mono text-[9px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-bold text-slate-800 leading-tight">{log.userName}</span>
                      <span className={`text-[8px] font-black px-1 rounded ${
                        log.userRole === 'OWNER' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {log.userRole}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3">
                    <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0 rounded text-[9px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 font-mono font-semibold text-indigo-900 text-[9px]">
                    {log.entityId}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600 max-w-md text-[9px] leading-tight">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
