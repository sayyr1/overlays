import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Wrapper que añade padding-bottom en móvil */}
      <App />
  </React.StrictMode>
);

// Si quieres medir rendimiento...
reportWebVitals();
