import React from 'react';
import { Link } from 'react-router-dom';
import HomeHorizontalShelf from './HomeHorizontalShelf';
import HomeSectionHeader from './HomeSectionHeader';

const VisualShelfCard = ({ item }) => (
  <Link
    to={item.to}
    className="group block w-[220px] shrink-0 overflow-hidden rounded-[20px] bg-[#efefe8] transition duration-300 hover:-translate-y-1"
  >
    <div className="relative aspect-[1.38/1] overflow-hidden bg-[#e9e8e1]">
      {item.image ? (
        <img
          src={item.image}
          alt={item.label}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#dcd9cf] text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
          {item.label}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent opacity-60" />
    </div>

    <div className="border-t border-black/5 bg-[#f7f7f2] px-4 py-3">
      <p className="line-clamp-1 text-base font-semibold text-slate-900">
        {item.label}
      </p>
      {item.meta ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          {item.meta}
        </p>
      ) : null}
    </div>
  </Link>
);

const VisualSkeleton = () => (
  <div className="w-[220px] shrink-0 animate-pulse overflow-hidden rounded-[20px] bg-[#1b1b1b]">
    <div className="aspect-[1.38/1] bg-[#242424]" />
    <div className="border-t border-white/10 px-4 py-3">
      <div className="h-4 w-2/3 rounded-full bg-white/10" />
      <div className="mt-2 h-3 w-1/3 rounded-full bg-white/10" />
    </div>
  </div>
);

export default function VisualShelfSection({
  eyebrow,
  title,
  to,
  linkLabel,
  items = [],
  loading = false,
  emptyMessage
}) {
  if (!loading && items.length === 0) {
    return emptyMessage ? (
      <section className="bg-[#141414] py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <HomeSectionHeader eyebrow={eyebrow} title={title} to={to} linkLabel={linkLabel} />
          <div className="mt-6 rounded-[24px] border border-white/10 bg-[#1b1b1b] px-6 py-10 text-center text-sm text-white/55 shadow-inner">
            {emptyMessage}
          </div>
        </div>
      </section>
    ) : null;
  }

  return (
    <section className="bg-[#141414] py-8">
      <div className="container mx-auto px-4 lg:px-8">
        <HomeSectionHeader eyebrow={eyebrow} title={title} to={to} linkLabel={linkLabel} />

        <div className="mt-6">
          {loading ? (
            <HomeHorizontalShelf>
              {Array.from({ length: 5 }).map((_, index) => (
                <VisualSkeleton key={`visual-skeleton-${index}`} />
              ))}
            </HomeHorizontalShelf>
          ) : (
            <HomeHorizontalShelf>
              {items.map(item => (
                <VisualShelfCard key={`${item.label}-${item.to}`} item={item} />
              ))}
            </HomeHorizontalShelf>
          )}
        </div>
      </div>
    </section>
  );
}
