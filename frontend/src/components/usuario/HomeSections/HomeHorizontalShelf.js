import React from 'react';

export default function HomeHorizontalShelf({ children, className = '' }) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className={`flex gap-4 pb-2 ${className}`}>
        {children}
      </div>
    </div>
  );
}
