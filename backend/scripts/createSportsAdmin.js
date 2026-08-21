import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import SportsAdmin from '../models/SportsAdmin.js';

dotenv.config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
if (!uri || !process.env.JWT_SECRET || !email || password.length < 12) {
  console.error('Configura MONGODB_URI, JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres).');
  process.exit(1);
}
await mongoose.connect(uri);
const passwordHash = await bcrypt.hash(password, 12);
await SportsAdmin.findOneAndUpdate({ email }, { $set: { email, name: process.env.ADMIN_NAME || 'Administrador', passwordHash, active: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
console.log(`Administrador listo: ${email}`);
await mongoose.disconnect();
