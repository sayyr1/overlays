// src/components/CategoriasPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../../../api/axiosInstance';
import Categoria from '../CardStyles/Categoria';

const CategoriasPage = () => {
  const { categoria } = useParams();
  const [products, setProducts] = useState([]);
  const [filters] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchFilteredProducts = async () => {
      setIsLoading(true);
      try {
        const filtros = { ...filters };
        if (categoria) filtros.type = categoria;

        const params = new URLSearchParams();
        Object.entries(filtros).forEach(([k, v]) => {
          Array.isArray(v) ? v.forEach(val => params.append(k, val)) : params.append(k, v);
        });

        const res = await axios.get(`/api/products/filtrar?${params}`);
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error filtrando:', err);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilteredProducts();
  }, [filters, categoria]);

  return (
    <div className="flex flex-col gap-8 px-4 pt-16 sm:px-6 lg:px-8">
      <h2 className="text-3xl text-center font-bold text-gray-800 mb-6">
        {categoria ? `Categoría: ${categoria}` : 'En Oferta'}
      </h2>


      {isLoading ? (
        <p className="text-center col-span-full">Cargando productos...</p>
      ) : products.length === 0 ? (
        <p className="text-center text-gray-500 col-span-full">No hay productos disponibles.</p>
      ) : (
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map(p => (
            <Categoria key={p._id} product={p} />
          ))}
        </section>
      )}
    </div>
  );
};

export default CategoriasPage;
