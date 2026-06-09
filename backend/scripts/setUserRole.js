import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { USER_ROLES, normalizeUserEmail, normalizeUsername } from '../models/User.js';

dotenv.config();

const [, , identifier, role] = process.argv;

if (!identifier || !role) {
  console.error('Uso: node scripts/setUserRole.js <usuario|email> <customer|sales|owner|admin|superadmin>');
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

const normalizedEmail = normalizeUserEmail(identifier);
const normalizedUsername = normalizeUsername(identifier);

const user = await User.findOne({
  $or: [
    ...(normalizedUsername ? [{ username: normalizedUsername }] : []),
    ...(normalizedEmail && normalizedEmail.includes('@') ? [{ email: normalizedEmail }] : [])
  ]
});
if (!user) {
  console.error('Usuario no encontrado');
  process.exit(1);
}

user.role = role;
await user.save();

console.log(`Usuario ${user.username} actualizado a rol ${role}`);
await mongoose.disconnect();
