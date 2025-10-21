import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { join } from 'path';
import Product from '../models/Product.js';
import User from '../models/User.js';

const envPath = join(process.cwd(), '.env');
dotenv.config({ path: envPath });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('No se encontró MONGO_URI/MONGODB_URI');
  process.exit(1);
}

const normalizePrice = product => {
  const current = product.price;
  if (current && typeof current === 'object' && current.retail !== undefined) {
    const retail = Number(current.retail ?? 0);
    product.price = {
      retail,
      gold: Number(current.gold ?? retail),
      premium: Number(current.premium ?? retail),
      platinum: Number(current.platinum ?? retail)
    };
    product.markModified('price');
    return;
  }
  const base = Number(current ?? 0);
  product.price = {
    retail: base,
    gold: base,
    premium: base,
    platinum: base
  };
  product.markModified('price');
};

const normalizeColors = product => {
  if (!product.colors) {
    product.colors = [];
    return;
  }
  if (Array.isArray(product.colors)) {
    product.colors = product.colors.map(color => String(color).trim()).filter(Boolean);
    return;
  }
  product.colors = String(product.colors)
    .split(',')
    .map(color => color.trim())
    .filter(Boolean);
  product.markModified('colors');
};

const migrate = async () => {
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const products = await Product.find();
  for (const product of products) {
    normalizePrice(product);
    normalizeColors(product);
    await product.save();
  }

  const users = await User.find({ membershipLevel: { $exists: false } });
  for (const user of users) {
    user.membershipLevel = 'STANDARD';
    await user.save();
  }

  await mongoose.disconnect();
  console.log('Migración completada');
  process.exit(0);
};

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});


