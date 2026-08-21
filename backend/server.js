import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import sportsRoutes from './routes/sports.js';

dotenv.config();
const app = express();
const isVercelRuntime = Boolean(process.env.VERCEL);
app.set('trust proxy', 1);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDirectExecution = process.argv[1] ? path.resolve(process.argv[1]) === __filename : false;
const localOrigins = ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'];
const configuredOrigins = [process.env.APP_BASE_URL, process.env.FRONTEND_URL, ...String(process.env.CORS_ORIGINS || '').split(',')].map(value => String(value || '').trim()).filter(Boolean);
const allowedOrigins = new Set([...localOrigins, ...configuredOrigins, ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])]);
const isPrivateDevelopmentOrigin = origin => {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || !['3000', '5000', ''].includes(url.port)) return false;
    const host = url.hostname;
    return /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
  } catch { return false; }
};
const isOriginAllowed = origin => {
  if (!origin || allowedOrigins.has(origin) || (!isVercelRuntime && isPrivateDevelopmentOrigin(origin))) return true;
  try { return Boolean(isVercelRuntime && new URL(origin).hostname.endsWith('.vercel.app')); } catch { return false; }
};
app.use(cors({ origin: (origin, callback) => callback(isOriginAllowed(origin) ? null : new Error('Origen no permitido por CORS'), isOriginAllowed(origin)), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });

let initializationPromise;
const initializeServer = async () => {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGODB_URI no está configurada');
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongoUri);
    else if (mongoose.connection.readyState === 2) await mongoose.connection.asPromise();
    return mongoose.connection;
  })().catch(error => { initializationPromise = null; throw error; });
  return initializationPromise;
};
app.use(async (req, res, next) => { try { await initializeServer(); next(); } catch (error) { console.error('Error inicializando servidor:', error.message); res.status(500).json({ message: 'No se pudo inicializar el backend.' }); } });
app.use((req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!mutating || !req.cookies?.sports_session || req.headers.authorization?.startsWith('Bearer ') || isOriginAllowed(req.headers.origin || '')) return next();
  return res.status(403).json({ message: 'Solicitud bloqueada por validación de origen.' });
});
app.get('/health', (req, res) => res.json({ ok: true, service: 'imbabura-en-vivo-api', runtime: isVercelRuntime ? 'vercel' : 'node', mongoReadyState: mongoose.connection.readyState }));
app.use('/api/sports', sportsRoutes);

const buildPath = path.join(__dirname, '..', 'frontend', 'build');
if (!isVercelRuntime && fs.existsSync(buildPath)) { app.use(express.static(buildPath)); app.get('/{*path}', (req, res) => res.sendFile(path.join(buildPath, 'index.html'))); }
app.use((error, req, res, next) => { console.error('Error de aplicación:', error.message); res.status(500).json({ message: 'Error interno del servidor.' }); });
if (!isVercelRuntime && isDirectExecution) initializeServer().then(() => app.listen(Number(process.env.PORT || 5000), () => console.log(`Backend escuchando en puerto ${process.env.PORT || 5000}`))).catch(error => { console.error('Error conectando a MongoDB:', error.message); process.exitCode = 1; });
export default app;
