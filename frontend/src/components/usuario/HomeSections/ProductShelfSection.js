import React from 'react';
import ProductMobileCard from '../ProductMobileCard/ProductMobileCard';
import HomeHorizontalShelf from './HomeHorizontalShelf';
import HomeSectionHeader from './HomeSectionHeader';

const ProductSkeleton = () => (
  <div className="w-[172px] shrink-0 sm:w-[188px] lg:w-[196px] xl:w-[204px]">
    <div className="animate-pulse">
      <div className="h-[152px] rounded-[18px] bg-[#f1f1f1] sm:h-[164px] lg:h-[172px]" />
      <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
      <div className="mt-2 h-3 w-2/5 rounded-full bg-white/10" />
      <div className="mt-2 h-5 w-1/3 rounded-full bg-white/10" />
      <div className="mt-3 h-6 w-24 rounded-md bg-white/10" />
    </div>
  </div>
);

export default function ProductShelfSection({
  eyebrow,
  title,
  to,
  products = [],
  loading = false,
  emptyMessage
}) {
  if (!loading && products.length === 0) {
    return emptyMessage ? (
      <section className="bg-[#141414] py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <HomeSectionHeader eyebrow={eyebrow} title={title} to={to} />
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
        <HomeSectionHeader eyebrow={eyebrow} title={title} to={to} />

        <div className="mt-6">
          {loading ? (
            <HomeHorizontalShelf>
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductSkeleton key={`product-skeleton-${index}`} />
              ))}
            </HomeHorizontalShelf>
          ) : (
            <HomeHorizontalShelf>
              {products.map(product => (
                <div
                  key={product._id}
                  className="w-[172px] shrink-0 sm:w-[188px] lg:w-[196px] xl:w-[204px]"
                >
                  <ProductMobileCard product={product} variant="market" />
                </div>
              ))}
            </HomeHorizontalShelf>
          )}
        </div>
      </div>
    </section>
  );
}
