import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ProductImage';
import { formatCurrency, getPriceForUser } from '../../../utils/pricing';
import { useAuth } from '../../../context/AuthContext';

const EnPromocion = ({ product }) => {
  const navigate = useNavigate();
  const { membershipLevel } = useAuth();
  const mainImage = product.images?.[0]?.url || '';

  const price = useMemo(
    () => getPriceForUser(product, membershipLevel),
    [product, membershipLevel]
  );

  const originalPrice = useMemo(() => {
    const base = price > 0 ? price : Number(product.price?.retail ?? 0);
    return base > 0 ? formatCurrency(base / 0.75) : formatCurrency(0);
  }, [price, product.price]);

  const handleClick = () => {
    navigate(`/product/${product._id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative group
        w-full sm:w-[240px] md:w-[280px] lg:w-[300px] xl:w-[320px]
        bg-white rounded-2xl shadow-md
        overflow-hidden
        mx-auto my-6 flex flex-col cursor-pointer
        hover:shadow-lg hover:-translate-y-1 transition-all duration-300
        focus:outline-none"
    >
      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
        En oferta
      </div>

      <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-2xl z-10">
        <span className="text-white text-lg font-semibold">Ver más detalles</span>
      </div>

      <div className="w-full h-[160px] md:h-[190px] overflow-hidden">
        <ProductImage
          src={mainImage}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="px-5 py-4 flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{product.name}</h3>
        <div className="flex flex-col items-start">
          <span className="text-base text-gray-400 line-through leading-tight">
            <span className="text-sm text-gray-500">Antes:</span> {originalPrice}
          </span>
          <span className="text-2xl font-bold text-red-600 leading-tight">
            <span className="text-sm text-gray-500">Ahora:</span> {formatCurrency(price)}
          </span>
        </div>
      </div>

      {product.stockBySize && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-500 uppercase mb-2">Tallas disponibles:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(product.stockBySize).map(
              ([size, qty]) =>
                qty > 0 && (
                  <span
                    key={size}
                    className="px-3 py-1 border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 transition"
                  >
                    {size}
                  </span>
                )
            )}
          </div>
        </div>
      )}
    </button>
  );
};

export default EnPromocion;
