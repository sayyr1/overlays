import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import brandRoutes from './routes/brands.js';
import categoryRoutes from './routes/categories.js';
import navigationRoutes from './routes/navigation.js';
import superAdminRoutes from './routes/superAdmin.js';
import publicRoutes from './routes/public.js';
import trackingRoutes from './routes/tracking.js';
import crmRoutes from './routes/crm.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import { router as userRoutes } from './routes/users.js';
import cartRoutes from './routes/cart.js';
import { ensureDefaultSettings } from './services/systemConfigService.js';
import { expirePendingOrders } from './controllers/orderController.js';

dotenv.config();

const app = express();
const isVercelRuntime = Boolean(process.env.VERCEL);

app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

const DEFAULT_ALLOWED_ORIGINS = [
  ...LOCAL_ALLOWED_ORIGINS,
  'https://niway.store',
  'https://www.niway.store'
];

const parseAllowedOrigins = () =>
  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const allowVercelPreviewOrigins = () => {
  const value = String(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS ?? 'true').trim().toLowerCase();
  return !['false', '0', 'no'].includes(value);
};

const allowedOrigins = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...parseAllowedOrigins()
]);

const isOriginAllowed = origin => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname;
    if (allowVercelPreviewOrigins() && hostname.endsWith('.vercel.app')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS not allowed for this origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

let initializationPromise = null;
let orderExpirationInterval = null;

const initializeServer = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI no esta configurada');
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    } else if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise();
    }

    await ensureDefaultSettings();
    return mongoose.connection;
  })().catch(error => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
};

const startOrderExpirationTask = () => {
  if (isVercelRuntime || orderExpirationInterval) {
    return;
  }

  orderExpirationInterval = setInterval(() => {
    expirePendingOrders().catch(error => {
      console.error('Error expirando pedidos pendientes:', error);
    });
  }, 5 * 60 * 1000);
};

app.use(async (req, res, next) => {
  try {
    await initializeServer();
    next();
  } catch (error) {
    console.error('Error inicializando servidor:', error);
    res.status(500).json({
      message: 'No se pudo inicializar el backend'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    runtime: isVercelRuntime ? 'vercel' : 'node',
    mongoReadyState: mongoose.connection.readyState
  });
});

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'niway-backend',
    runtime: isVercelRuntime ? 'vercel' : 'node'
  });
});

app.use('/api/brands', brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/crm', crmRoutes);

const buildPath = path.join(__dirname, '..', 'frontend', 'build');
const hasLocalFrontendBuild = fs.existsSync(buildPath);

if (!isVercelRuntime && hasLocalFrontendBuild) {
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

if (!isVercelRuntime && isDirectExecution) {
  initializeServer()
    .then(() => {
      startOrderExpirationTask();
      const port = Number(process.env.PORT || 5000);
      app.listen(port, () => {
        console.log(`Backend escuchando en puerto ${port}`);
      });
    })
    .catch(error => {
      console.error('Error conectando a MongoDB:', error);
      process.exitCode = 1;
    });
}

export default app;
