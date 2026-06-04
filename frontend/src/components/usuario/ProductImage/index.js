import React from 'react';

/**
 * Componente que muestra la primera imagen de Cloudinary
 * o un fallback, y acepta cualquier prop extra (onClick, etc).
 */
const ProductImage = ({ src, alt, className, ...props }) => {
  const imgUrl = src && src.length > 0
    ? src
    : '/default.jpg';  // tu imagen por defecto

  return (
    <img
      src={imgUrl}
      alt={alt}
      className={className}
      {...props}         // <— aquí propagamos onClick, style, etc.
    />
  );
};

export default ProductImage;
