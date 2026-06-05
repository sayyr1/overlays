import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import HeroSection from '../HomeSections/HeroSection';
import FeaturedProductsSection from '../HomeSections/FeaturedProductsSection';
import CategoriesSection from '../HomeSections/CategoriesSection';
import OrigenSection from '../HomeSections/OrigenSection';
import MoreProductsSection from '../HomeSections/MoreProductsSection';
import BrandsSection from '../HomeSections/BrandsSection';
import CollectionsSection from '../HomeSections/CollectionsSection';
import { usePublicConfig } from '../../../context/PublicConfigContext';

export default function HomePage() {
  const { loading, isModuleEnabled } = usePublicConfig();
  const [products, setProducts] = useState([]);
  const [categoriesData, setCategoriesData] = useState({});
  const [productsLoading, setProductsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const productsEnabled = isModuleEnabled('products');
  const categoriesEnabled = isModuleEnabled('categories');

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
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="flex flex-col">
      {productsEnabled && <HeroSection />}
      {productsEnabled && (
        <MoreProductsSection products={products} loading={productsLoading} />
      )}
      {productsEnabled && (
        <FeaturedProductsSection products={products} loading={productsLoading} />
      )}
      {productsEnabled && categoriesEnabled && (
        <CategoriesSection
          limit={6}
          products={products}
          categoriesData={categoriesData}
          loading={productsLoading || categoriesLoading}
        />
      )}
      {productsEnabled && <BrandsSection products={products} loading={productsLoading} />}
      {productsEnabled && <CollectionsSection products={products} loading={productsLoading} />}
      {productsEnabled && categoriesEnabled && (
        <OrigenSection
          limit={6}
          products={products}
          categoriesData={categoriesData}
          loading={productsLoading || categoriesLoading}
        />
      )}
    </div>
  );
}
