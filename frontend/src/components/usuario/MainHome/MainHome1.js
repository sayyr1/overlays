import React from 'react';
import FeaturedProductsSection from '../HomeSections/FeaturedProductsSection';
import CategoriesSection from '../HomeSections/CategoriesSection';
import OrigenSection from '../HomeSections/OrigenSection';
import MoreProductsSection from '../HomeSections/MoreProductsSection';
import { usePublicConfig } from '../../../context/PublicConfigContext';

export default function HomePage() {
  const { loading, isModuleEnabled } = usePublicConfig();

  if (loading) {
    return <div className="min-h-[40vh]" />;
  }

  const productsEnabled = isModuleEnabled('products');
  const categoriesEnabled = isModuleEnabled('categories');

  return (
    <div className="flex flex-col">
      {productsEnabled && <FeaturedProductsSection />}
      {productsEnabled && categoriesEnabled && <OrigenSection limit={8} />}
      {productsEnabled && categoriesEnabled && <CategoriesSection limit={10} />}
      {productsEnabled && <MoreProductsSection />}
    </div>
  );
}
