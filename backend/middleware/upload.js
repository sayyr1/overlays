import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utils/cloudinary.js';

const uploadFolder = String(process.env.CLOUDINARY_UPLOAD_FOLDER || 'storefront-assets').trim();

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: uploadFolder,
    allowed_formats: ['jpg', 'png', 'jpeg']
  }
});

const upload = multer({ storage });

export default upload;
