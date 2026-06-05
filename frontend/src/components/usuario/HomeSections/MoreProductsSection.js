import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import ProductShelfSection from './ProductShelfSection';

const MoreProductsSection = ({ products: providedProducts, loading: providedLoading = false }) => {
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(!providedProducts);

  useEffect(() => {
    const getRecentProducts = allProducts => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setHours(0, 0, 0, 0);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      return allProducts
        .filter(product => {
          const createdAt = new Date(product.createdAt);
          return !Number.isNaN(createdAt.valueOf()) && createdAt >= twoWeeksAgo;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 12);
    };

    if (providedProducts) {
      setRecentProducts(getRecentProducts(providedProducts));
      setLoading(Boolean(providedLoading));
      return;
    }

    const fetchRecentProducts = async () => {
      try {
        const { data } = await axios.get('/api/products');
        const allProducts = Array.isArray(data) ? data : [];
        setRecentProducts(getRecentProducts(allProducts));
      } catch (error) {
        console.error('Error cargando productos recientes', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentProducts();
  }, [providedLoading, providedProducts]);

  if (!loading && recentProducts.length === 0) {
    return null;
  }

  return (
    <ProductShelfSection
      title="Nuevos"
      to="/nuevos"
      products={recentProducts}
      loading={loading}
    />
  );
};

export default MoreProductsSection;
