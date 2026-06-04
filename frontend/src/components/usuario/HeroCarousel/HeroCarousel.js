// CAROUSEL DE OFERTAS

import React, { useEffect, useState } from 'react';
import axios from '../../../api/axiosInstance';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, A11y } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import EnPromocion from '../CardStyles/EnPromocion';

const HeroCarousel = ({ storeSlug }) => {
  const [slides, setSlides] = useState([]);

  useEffect(() => {
    const fetchPromos = async () => {
      try {
        const res = await axios.get(`/api/products/promocion?store=${storeSlug}`);
        setSlides(res.data);
      } catch (err) {
        console.error('❌ Error cargando promociones:', err);
      }
    };
    fetchPromos();
  }, [storeSlug]); // Dependemos del storeSlug

  // Si no hay productos en oferta, mostramos un mensaje
  if (slides.length === 0) {
    return <div className="no-promotion-message">No hay productos en oferta en esta tienda.</div>;
  }

  return (
    <div className="hero-carousel w-full max-w-screen-xl mx-auto py-8 px-4">
      <Swiper
        modules={[Navigation, Pagination, A11y]}
        spaceBetween={16}  // Ajusta el espacio entre las tarjetas
        slidesPerView={2}
        navigation
        pagination={{ clickable: true }}
        breakpoints={{
          640: { slidesPerView: 2 },
          768: { slidesPerView: 2 },
          1024: { slidesPerView: 3 },
          1280: { slidesPerView: 4 },
        }}
        className="px-4"
      >
          {slides.map((product) => (
              <SwiperSlide key={product._id}>
                  <div className="card-container w-full px-1 max-w-[200px] sm:px-2 sm:max-w-none">
                      <EnPromocion product={product} />
                  </div>
              </SwiperSlide>
          ))}

      </Swiper>
    </div>
  );
};

export default HeroCarousel;
