import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import Nuevos from '../CardStyles/Nuevos';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

const skeletonItems = Array.from({ length: 4 }, (_, index) => index);

const MoreProductsSection = () => {
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentProducts = async () => {
      try {
        const { data } = await axios.get('/api/products');
        const allProducts = Array.isArray(data) ? data : [];

        const twoWeeksAgo = new Date();
        twoWeeksAgo.setHours(0, 0, 0, 0);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const filtered = allProducts.filter(product => {
          const createdAt = new Date(product.createdAt);
          return !Number.isNaN(createdAt.valueOf()) && createdAt >= twoWeeksAgo;
        });

        const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentProducts(sorted.slice(0, 12));
      } catch (error) {
        console.error('Error cargando productos recientes', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentProducts();
  }, []);

  if (!loading && recentProducts.length === 0) {
    return null;
  }

  return (
    <section className="relative isolate overflow-hidden bg-white py-16">
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-white via-slate-50 to-white" />

      <div className="container mx-auto px-4 lg:px-10">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-sky-500">
            Últimos lanzamientos
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.3rem]">
            Recién agregados
          </h2>
          <p className="mx-auto max-w-2xl text-base text-[#5f6168] sm:text-lg">
            Descubre los productos más recientes añadidos a nuestro catálogo y mantente al día con
            las últimas tendencias.
          </p>
        </div>

        {loading && (
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {skeletonItems.map(item => (
              <div
                key={`recent-skeleton-${item}`}
                className="h-72 animate-pulse rounded-[32px] border border-white/70 bg-white/85 shadow-inner shadow-slate-200"
              />
            ))}
          </div>
        )}

        {!loading && recentProducts.length > 0 && (
          <Swiper
            modules={[Navigation, Pagination, A11y]}
            spaceBetween={24}
            slidesPerView={1.2}
            navigation
            pagination={{ clickable: true }}
            breakpoints={{
              640: { slidesPerView: 1.6 },
              768: { slidesPerView: 2.2 },
              1024: { slidesPerView: 3 },
              1280: { slidesPerView: 3.5 }
            }}
            className="mt-10 !pb-16"
          >
            {recentProducts.map(product => (
              <SwiperSlide key={product._id}>
                <div className="px-2">
                  <div className="rounded-[32px] border border-white/70 bg-white/95 p-2 shadow-xl shadow-slate-900/5 transition hover:-translate-y-1 hover:shadow-2xl">
                    <Nuevos product={product} />
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>
    </section>
  );
};

export default MoreProductsSection;
