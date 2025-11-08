import React from 'react';
import HeroSection from '../HomeSections/HeroSection';
import InfoIconsSection from '../HomeSections/InfoIconsSection';
import FeaturedProductsSection from '../HomeSections/FeaturedProductsSection';
import CategoriesSection from '../HomeSections/CategoriesSection';
import OrigenSection from '../HomeSections/OrigenSection';
import InfoBannerSection from '../HomeSections/InfoBannerSection';
import MoreProductsSection from '../HomeSections/MoreProductsSection';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* <HeroSection /> */}
      {/* <InfoIconsSection /> */}
      <FeaturedProductsSection />
      <CategoriesSection limit={10} />
      <OrigenSection limit={8} />
      {/* <InfoBannerSection /> */}
      <MoreProductsSection />
    </div>
  );
}
