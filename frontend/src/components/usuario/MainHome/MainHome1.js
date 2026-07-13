import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../../api/axiosInstance';
import HeroSection from '../HomeSections/HeroSection';
import FeaturedProductsSection from '../HomeSections/FeaturedProductsSection';
import CategoriesSection from '../HomeSections/CategoriesSection';
import OrigenSection from '../HomeSections/OrigenSection';
import MoreProductsSection from '../HomeSections/MoreProductsSection';
import BrandsSection from '../HomeSections/BrandsSection';
import CollectionsSection from '../HomeSections/CollectionsSection';
import { usePublicConfig } from '../../../context/PublicConfigContext';
import { createDefaultHomeSections, normalizeHomeSections } from '../../../utils/homeLayout';

const HomeLoadingSkeleton = () => (
  <div className="flex flex-col gap-6">
    <section className="min-h-[42vh] bg-[radial-gradient(circle_at_top,#78d64b1f,transparent_45%),linear-gradient(180deg,#171717,#101010)]">
      <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl animate-pulse">
          <div className="h-4 w-32 rounded-full bg-white/10" />
          <div className="mt-5 h-12 w-full max-w-2xl rounded-3xl bg-white/10" />
          <div className="mt-3 h-12 w-4/5 rounded-3xl bg-white/10" />
          <div className="mt-6 h-5 w-full max-w-xl rounded-full bg-white/10" />
          <div className="mt-3 h-5 w-3/4 rounded-full bg-white/10" />
          <div className="mt-8 flex gap-3">
            <div className="h-11 w-36 rounded-full bg-white/10" />
            <div className="h-11 w-32 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </section>

    <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`home-skeleton-${index}`} className="animate-pulse">
            <div className="aspect-[4/5] rounded-[1.75rem] bg-white/10" />
            <div className="mt-3 h-4 w-4/5 rounded-full bg-white/10" />
            <div className="mt-2 h-3 w-2/5 rounded-full bg-white/10" />
            <div className="mt-3 h-5 w-1/3 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  </div>
);

export default function HomePage() {
  const { loading, homeLayout, isModuleEnabled } = usePublicConfig();
  const [products, setProducts] = useState([]);
  const [categoriesData, setCategoriesData] = useState({});
  const [productsLoading, setProductsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const sections = useMemo(
    () => normalizeHomeSections(homeLayout?.sections || createDefaultHomeSections()),
    [homeLayout]
  );
  const visibleSections = useMemo(
    () => sections.filter(section => section.enabled !== false),
    [sections]
  );
  const needsProducts = visibleSections.some(section =>
    ['hero', 'new_arrivals', 'featured_products', 'categories', 'brands', 'collections', 'origins'].includes(section.type)
  );
  const needsCategories = visibleSections.some(section =>
    ['categories', 'origins'].includes(section.type)
  );

  const productsEnabled = isModuleEnabled('products') && needsProducts;
  const categoriesEnabled = isModuleEnabled('categories') && needsCategories;

  useEffect(() => {
    if (!productsEnabled) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    let cancelled = false;

    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const { data } = await axios.get('/api/products');
        if (!cancelled) {
          setProducts(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Error cargando productos del home', error);
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [productsEnabled]);

  useEffect(() => {
    if (!(productsEnabled && categoriesEnabled)) {
      setCategoriesData({});
      setCategoriesLoading(false);
      return;
    }

    let cancelled = false;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const { data } = await axios.get('/api/categories');
        if (!cancelled) {
          setCategoriesData(data || {});
        }
      } catch (error) {
        console.error('Error cargando categorias del home', error);
        if (!cancelled) {
          setCategoriesData({});
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [categoriesEnabled, productsEnabled]);

  if (loading) {
    return <HomeLoadingSkeleton />;
  }

  const renderSection = section => {
    if (section.type === 'hero') {
      return (
        <HeroSection
          eyebrow={section.settings?.eyebrow || section.eyebrow || undefined}
          title={section.settings?.title || undefined}
          description={section.settings?.description || undefined}
          primaryCtaLabel={section.settings?.primaryCtaLabel || undefined}
          primaryCtaTo={section.settings?.primaryCtaTo || undefined}
          secondaryCtaLabel={section.settings?.secondaryCtaLabel || undefined}
          secondaryCtaTo={section.settings?.secondaryCtaTo || undefined}
        />
      );
    }

    if (section.type === 'new_arrivals') {
      return (
        <MoreProductsSection
          products={products}
          loading={productsLoading}
          title={section.title || 'Nuevos'}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/nuevos'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 12}
        />
      );
    }

    if (section.type === 'featured_products') {
      return (
        <FeaturedProductsSection
          products={products}
          loading={productsLoading}
          title={section.title || 'Ofertas'}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/ofertas'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 12}
        />
      );
    }

    if (section.type === 'categories' && categoriesEnabled) {
      return (
        <CategoriesSection
          title={section.title || undefined}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/categorias'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 6}
          products={products}
          categoriesData={categoriesData}
          loading={productsLoading || categoriesLoading}
        />
      );
    }

    if (section.type === 'brands') {
      return (
        <BrandsSection
          products={products}
          loading={productsLoading}
          title={section.title || 'Marcas'}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/marcas'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 6}
        />
      );
    }

    if (section.type === 'collections') {
      return (
        <CollectionsSection
          products={products}
          loading={productsLoading}
          title={section.title || 'Coleccion'}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/colecciones'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 6}
        />
      );
    }

    if (section.type === 'origins' && categoriesEnabled) {
      return (
        <OrigenSection
          title={section.title || 'Origen'}
          eyebrow={section.eyebrow || undefined}
          to={section.linkTo || '/origen'}
          linkLabel={section.linkLabel || 'Ver mas'}
          limit={section.limit || 6}
          products={products}
          categoriesData={categoriesData}
          loading={productsLoading || categoriesLoading}
        />
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col">
      {visibleSections.map(section => (
        <React.Fragment key={section.id}>
          {productsEnabled || section.type === 'hero' ? renderSection(section) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
