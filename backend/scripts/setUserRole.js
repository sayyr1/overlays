import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { USER_ROLES } from '../models/User.js';

dotenv.config();

const [, , email, role] = process.argv;

if (!email || !role) {
  console.error('Uso: node scripts/setUserRole.js <email> <customer|admin|superadmin>');
  process.exit(1);
}

if (!Object.values(USER_ROLES).includes(role)) {
  console.error('Rol inválido');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('Falta MONGO_URI');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error('Usuario no encontrado');
  process.exit(1);
}

user.role = role;
await user.save();

console.log(`Usuario ${email} actualizado a rol ${role}`);
await mongoose.disconnect();
