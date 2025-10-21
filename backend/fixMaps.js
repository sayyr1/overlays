// fixMaps.js
import mongoose from 'mongoose';
import Product from './models/Product.js'; // ajusta si tu ruta es diferente

const runFix = async () => {
  await mongoose.connect(
    'mongodb+srv://peermentoredwinquinchiguango:3y3k3pRf8LlcexAi@cluster0.ky3480z.mongodb.net/Brand418db?retryWrites=true&w=majority'
  ); // pon el nombre correcto

  const products = await Product.find();

  for (const product of products) {
    let updated = false;

    if (product.stockBySize && !(product.stockBySize instanceof Map)) {
      product.stockBySize = new Map(Object.entries(product.stockBySize));
      updated = true;
    }

    if (product.soldBySize && !(product.soldBySize instanceof Map)) {
      product.soldBySize = new Map(Object.entries(product.soldBySize));
      updated = true;
    }

    if (product.reservedBySize && !(product.reservedBySize instanceof Map)) {
      product.reservedBySize = new Map(Object.entries(product.reservedBySize));
      updated = true;
    }

    if (updated) {
      await product.save();
      console.log(`Corregido: ${product.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('Todos los productos actualizados');
};

runFix().catch(console.error);
