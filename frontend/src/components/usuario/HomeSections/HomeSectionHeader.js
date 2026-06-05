import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

export default function HomeSectionHeader({
  eyebrow,
  title,
  to,
  linkLabel = 'Ver mas'
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/45">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
          {title}
        </h2>
      </div>

      {to ? (
        <Link
          to={to}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-white"
        >
          {linkLabel}
          <FiArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
