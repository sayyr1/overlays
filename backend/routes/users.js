import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

const attachAuthCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 1000
  };
  // Permite fijar el dominio por entorno si se usa el mismo TLD en subdominios
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  res.cookie('access_token', token, cookieOptions);
};

// Registro de usuario
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  const exist = await User.findOne({ email });
  if (exist) return res.status(400).json({ message: 'Email ya registrado' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed });

  const token = generateToken(user._id, user.isAdmin);
  attachAuthCookie(res, token);

  res.status(201).json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipLevel: user.membershipLevel
    }
  });
});

// Login de usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Contrase\u00f1a incorrecta' });

  const token = generateToken(user._id, user.isAdmin);
  attachAuthCookie(res, token);

  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      membershipLevel: user.membershipLevel
    }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  });
  res.status(204).end();
});

// Verificación de token
router.get('/verify-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ message: 'Token inv\u00e1lido' });

    res.json({ valid: true, user });
  } catch (err) {
    res.status(401).json({ message: 'Token expirado o inv\u00e1lido' });
  }
});

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

router.put('/:id/membership', protect, adminOnly, async (req, res) => {
  const { membershipLevel } = req.body;
  if (!['STANDARD', 'GOLD', 'PREMIUM', 'PLATINUM'].includes(membershipLevel)) {
    return res.status(400).json({ message: 'Nivel de cliente inválido' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { membershipLevel },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar nivel de cliente' });
  }
});

export { router };
