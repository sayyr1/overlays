import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User, { USER_ROLES, normalizeUsername } from '../models/User.js';

dotenv.config();

const [usernameArg = '', passwordArg = '', roleArg = ''] = process.argv.slice(2);

const username = normalizeUsername(usernameArg);
const password = String(passwordArg || '');
const role = String(roleArg || '').trim() || USER_ROLES.SUPERADMIN;

const allowedRoles = new Set(Object.values(USER_ROLES));

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI no esta configurada');
}

if (!username) {
  throw new Error('Debes indicar un nombre de usuario valido');
}

if (password.length < 6) {
  throw new Error('La contrasena debe tener al menos 6 caracteres');
}

if (!allowedRoles.has(role)) {
  throw new Error(`Rol invalido: ${role}`);
}

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error(`No se encontro el usuario ${username}`);
  }

  user.password = await bcrypt.hash(password, 10);
  user.role = role;
  await user.save();

  console.log(`Acceso restablecido para ${user.username} con rol ${user.role}`);
};

main()
  .catch(error => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
