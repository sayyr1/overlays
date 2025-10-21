// backend/utils/cloudinary.js
import dotenv from 'dotenv';
dotenv.config();                         // ← carga aquí el .env

import { v2 as cloudinary } from 'cloudinary';

console.log('🔑 CLOUDINARY config:',
  'cloud_name=', process.env.CLOUDINARY_CLOUD_NAME,
  'api_key=',    process.env.CLOUDINARY_API_KEY ? '✓' : '✗',
  'api_secret=', process.env.CLOUDINARY_API_SECRET ? '✓' : '✗'
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
