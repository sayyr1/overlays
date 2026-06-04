import React, { useEffect, useState } from 'react';
import { getSuperAdminAuditLogs } from '../../api/superAdmin';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await getSuperAdminAuditLogs();
      setLogs(Array.isArray(data) ? data : []);
    };
    load();
  }, []);

  return (
    <section className="rounded-3xl bg-white p-8 shadow-brand-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Audit logs</h2>
      <p className="mt-2 text-sm text-slate-500">Cambios importantes realizados desde el Super Admin.</p>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Entidad</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {logs.map(log => (
              <tr key={log._id}>
                <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3">{log.user?.email || 'Sistema'}</td>
                <td className="px-4 py-3">{log.action}</td>
                <td className="px-4 py-3">{log.entity}</td>
                <td className="px-4 py-3">{log.ip || 'S/D'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AuditLogsPage;
