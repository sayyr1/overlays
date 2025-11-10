import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductImage from '../ProductImage';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { getPriceForUser, formatCurrency } from '../../../utils/pricing';

const ProductMobileCard = ({ product }) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuthenticated, membershipLevel } = useAuth();

  const availableSizes = useMemo(
    () => Object.entries(product.stockBySize || {}).filter(([, qty]) => qty > 0),
    [product.stockBySize]
  );

  const availableColors = useMemo(
    () => (Array.isArray(product.colors) ? product.colors.filter(Boolean) : []),
    [product.colors]
  );

  const priceForUser = useMemo(
    () => getPriceForUser(product, membershipLevel),
    [product, membershipLevel]
  );

  const handleViewDetails = () => {
    navigate(`/product/${product._id}`);
  };

  const handleQuickAdd = async () => {
    if (availableSizes.length !== 1) {
      handleViewDetails();
      return;
    }

    const [size] = availableSizes[0];
    try {
      await addItem({
        productId: product._id,
        size,
        quantity: 1,
        unitPrice: priceForUser,
        title: product.name,
        imageUrl: product.images?.[0]?.url || '',
        color: availableColors.length === 1 ? availableColors[0] : ''
      });
    } catch (error) {
      console.error('Error al agregar al carrito', error);
    }
  };

  const buildWhatsAppHref = () => {
    try {
      const phone = 593987547819;
      const name = product?.name || '';
      const price = formatCurrency(priceForUser || 0);
      const url = `${window.location.origin}/product/${product?._id}`;
      const message = `Hola 👋, me interesa este producto:%0A- Nombre: ${encodeURIComponent(name)}%0A- Precio: ${encodeURIComponent(price)}%0A- URL: ${encodeURIComponent(url)}`;
      const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
      return `${base}?text=${message}`;
    } catch {
      return 'https://wa.me/';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <button type="button" onClick={handleViewDetails} className="w-full">
        <div className="w-full aspect-[4/3] overflow-hidden">
          <ProductImage
            src={product.images?.[0]?.url || ''}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      </button>
      <div className="px-4 py-3">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-base font-semibold text-gray-800 truncate mr-3">{product.name}</h3>
          <span className="text-lg font-bold text-blue-600">
            {formatCurrency(priceForUser)}
          </span>
        </div>

        {availableColors.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase mb-1">Colores</p>
            <div className="flex flex-wrap gap-1">
              {availableColors.map(color => (
                <span
                  key={color}
                  className="px-2 py-1 border border-gray-200 rounded-full text-xs text-gray-700"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {availableSizes.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 uppercase mb-1">Tallas disponibles</p>
            <div className="flex flex-wrap gap-1">
              {availableSizes.map(([size]) => (
                <span
                  key={size}
                  className="px-2 py-1 border border-gray-200 rounded-full text-xs text-gray-700"
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleViewDetails}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition duration-200"
            >
              Ver detalles
            </button>
            <button
              type="button"
              onClick={handleQuickAdd}
              className="flex-1 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
            >
              Agregar al carrito
            </button>
          </div>
          <a
            href={buildWhatsAppHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 text-center font-semibold rounded-md border border-green-500 text-green-700 hover:bg-green-50 transition"
          >
            Pedir por WhatsApp
          </a>
        </div>
        {availableSizes.length === 0 && (
          <p className="mt-2 text-xs text-red-500">Sin stock disponible.</p>
        )}
      </div>
    </div>
  );
};

export default ProductMobileCard;
