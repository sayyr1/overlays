import React from 'react';
import { DocumentTextIcon, EyeIcon, UserPlusIcon } from '@heroicons/react/24/outline';

const BENEFITS = [
  {
    icon: DocumentTextIcon,
    title: 'Catalogo autogestionado',
    text: 'Crea colecciones, controla precios dinamicos y edita inventario en segundos.'
  },
  {
    icon: EyeIcon,
    title: 'Visibilidad omnicanal',
    text: 'Optimiza producto para SEO, pauta ads y experiencias sociales.'
  },
  {
    icon: UserPlusIcon,
    title: 'Ecosistema de fidelizacion',
    text: 'Perfiles unicos, membership tiers y beneficios exclusivos para tu comunidad.'
  }
];

const BenefitCard = ({ icon: Icon, title, text }) => (
  <div className="surface-card h-full p-6 text-left">
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
    <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{text}</p>
  </div>
);

export default function InfoIconsSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4 lg:px-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {BENEFITS.map(benefit => (
            <BenefitCard
              key={benefit.title}
              icon={benefit.icon}
              title={benefit.title}
              text={benefit.text}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
