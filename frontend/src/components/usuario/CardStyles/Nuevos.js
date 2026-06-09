import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductImage from '../ProductImage';
import { formatCurrency, getPriceForUser } from '../../../utils/pricing';
import { useAuth } from '../../../context/AuthContext';

const Nuevos = ({ product }) => {
  const navigate = useNavigate();
  const { membershipLevel } = useAuth();
  const mainImage = product.images?.[0]?.url || '';

  const price = useMemo(
    () => getPriceForUser(product, membershipLevel),
    [product, membershipLevel]
  );

  const handleClick = () => {
    navigate(`/product/${product._id}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative group h-full w-full bg-white rounded-2xl shadow-md border-l-4 border-gray-500 overflow-hidden mx-auto flex flex-col cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 focus:outline-none"
    >
      <div className="absolute top-3 left-3 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded shadow z-20">
        Nuevo
      </div>

      <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-2xl z-10">
        <span className="text-white text-lg font-semibold">Ver más detalles</span>
      </div>

      <div className="w-full h-[250px] overflow-hidden">
        <ProductImage
          src={mainImage}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="px-5 py-4 flex flex-col gap-1">
        <h3 className="mb-1 line-clamp-2 text-lg font-semibold text-gray-800">{product.name}</h3>
        <span className="text-2xl font-bold text-red-600 leading-tight">
          {formatCurrency(price)}
        </span>
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

      {product.colors?.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-500 uppercase mb-2">Colores</p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map(color => (
              <span
                key={color}
                className="px-3 py-1 border border-gray-200 rounded-full text-sm text-gray-700"
              >
                {color}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
};

export default Nuevos;
