import React from 'react';

const SERVICE_GUARANTEES = [
  {
    title: 'Compra sin registro',
    description: 'Tu cliente puede crear su pedido sin abrir cuenta ni pasar por pasos innecesarios.'
  },
  {
    title: 'Atencion por WhatsApp',
    description: 'Cuando necesita ayuda, puede continuar la compra o resolver dudas desde el chat.'
  },
  {
    title: 'Reserva de stock',
    description: 'Los pedidos quedan apartados para reducir friccion mientras se confirma el pago.'
  },
  {
    title: 'Seguimiento claro',
    description: 'Pedidos, estados y contacto visibles para que la experiencia no se sienta incierta.'
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
