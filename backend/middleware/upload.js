import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utils/cloudinary.js';

const uploadFolder = String(process.env.CLOUDINARY_UPLOAD_FOLDER || 'storefront-assets').trim();

let storage;

try {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: uploadFolder,
      allowed_formats: ['jpg', 'png', 'jpeg']
    }
  });
} catch (error) {
  console.error('No se pudo inicializar CloudinaryStorage. Se usara memoria temporal:', error);
  storage = multer.memoryStorage();
}

const upload = multer({ storage });

export default upload;
