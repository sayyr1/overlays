// backend/app.js
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import brandRoutes     from './routes/brands.js';
import categoryRoutes  from './routes/categories.js';
import navigationRoutes from './routes/navigation.js';

import productRoutes   from './routes/products.js';
import orderRoutes    from './routes/orders.js';
import { router as userRoutes } from './routes/users.js';
import cartRoutes      from './routes/cart.js';

dotenv.config();

const app = express();

// __dirname para ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('❌ CORS not allowed for this origin: ' + origin));
  },
  credentials: true
}));

// JSON parser
app.use(express.json());
app.use(cookieParser());

// Rutas API
app.use('/api/brands',     brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products',   productRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/cart',       cartRoutes);
app.use('/api/orders',     orderRoutes);
app.use('/api/navigation', navigationRoutes);

// Conexión MongoDB y arranque del servidor
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
  .then(() => {
    app.listen(process.env.PORT || 5000, () => {
      console.log(`✅ Backend escuchando en puerto ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Servir frontend desde build
const buildPath = path.join(__dirname, 'frontend/build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});


