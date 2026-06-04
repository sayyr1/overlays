import React from 'react';

const SERVICE_GUARANTEES = [
  {
    title: 'Envio express',
    description: 'Gratis desde $50. Logistica nacional con cobertura 24h en principales ciudades.'
  },
  {
    title: 'Soporte 24/7',
    description: 'Equipo concierge disponible por chat, mail o WhatsApp los 7 dias de la semana.'
  },
  {
    title: 'Pagos protegidos',
    description: 'Integraciones certificadas con tarjetas, wallets y debitos instantaneos.'
  },
  {
    title: 'Cambios sin friccion',
    description: '30 dias para cambios o devoluciones con etiquetas prepagadas.'
  }
];

export default function InfoBannerSection() {
  return (
    <section className="py-14">
      <div className="container mx-auto px-4 lg:px-10">
        <div className="overflow-hidden rounded-3xl bg-brand/10 p-8 shadow-brand-sm lg:p-10">
          <div className="grid grid-cols-1 gap-6 text-slate-900 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICE_GUARANTEES.map(item => (
              <div key={item.title} className="rounded-2xl border border-white/40 bg-white/60 p-6 backdrop-blur">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
