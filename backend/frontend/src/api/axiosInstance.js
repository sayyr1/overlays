  // src/api/axiosInstance.js
  import axios from 'axios';

  // ⬇️ COMENTA Y DESCOMENTA SEGÚN TU ENTORNO

  // ✅ Localhost (DESARROLLO LOCAL)
  //const baseURL = 'http://localhost:5000';

  // ✅ Render (PRODUCCIÓN)
const baseURL = process.env.REACT_APP_API_URL || 'https://niway-dzxk.onrender.com';
  console.log('🌐 Usando baseURL:', baseURL);

  const instance = axios.create({
    baseURL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  export { baseURL }; // <-- Agrega esto

  export default instance;
