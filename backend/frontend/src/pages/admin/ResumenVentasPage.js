import React, { useEffect, useState } from 'react';
import axios from '../../api/axiosInstance';
import Navbar from '../usuario/Navbar';

const ResumenVentasPage = () => {
  const [ventas, setVentas] = useState([]);

  const fetchResumen = async () => {
    try {
      const res = await axios.get('/api/products/summary/sales');
      console.log("🧾 Datos de ventas recibidos:", res.data);
      setVentas(res.data);
    } catch (err) {
      console.error("❌ Error al obtener resumen de ventas:", err);
    }
  };

  useEffect(() => {
    fetchResumen();
  }, []);

  const totalGeneral = ventas.reduce((acc, v) => acc + parseFloat(v.total), 0).toFixed(2);

  const handleReset = async () => {
    const confirmReset = window.confirm("¿Estás seguro de que deseas eliminar todo el historial de ventas?");
    if (!confirmReset) return;

    try {
      await axios.post('/api/products/reset-sales');
      alert('✅ Ventas reiniciadas correctamente.');
      fetchResumen(); // refresca la tabla sin recargar la página
    } catch (err) {
      console.error('❌ Error al reiniciar ventas:', err);
      alert('❌ Ocurrió un error al intentar reiniciar las ventas.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto p-6">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6">📈 Resumen de Ventas</h2>

        <button
          onClick={handleReset}
          className="mb-6 px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-300"
        >
          🔁 Resetear Ventas
        </button>

        {ventas.length === 0 ? (
          <p className="text-center text-gray-500">No hay productos vendidos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-lg">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Producto</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Código</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Talla</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Cantidad Vendida</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Precio Unitario</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Total</th>
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-600">Fecha de Venta</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-3 px-4 text-sm text-gray-800">{v.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{v.code}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{v.size}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{v.quantity}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">${parseFloat(v.price).toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-semibold">${parseFloat(v.total).toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{v.lastSoldAt ? new Date(v.lastSoldAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
                <tr className="bg-gray-200">
                  <td colSpan="5" className="py-3 px-4 text-sm font-semibold text-gray-800 text-right">TOTAL GENERAL:</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-800">${totalGeneral}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumenVentasPage;
