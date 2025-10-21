import axios from 'axios';

const defaultBaseUrl =
  process.env.NODE_ENV === 'production'
    ? 'https://tienda-418brand.onrender.com'
    : 'http://localhost:5000';

const baseURL = process.env.REACT_APP_API_URL || defaultBaseUrl;

const instance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export { baseURL };
export default instance;

