import jwt from 'jsonwebtoken';
import SportsAdmin from '../models/SportsAdmin.js';

const getToken = req => req.cookies?.sports_session || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
export const requireSportsAdmin = async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ message: 'Debes iniciar sesión para continuar.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await SportsAdmin.findById(payload.sub);
    if (!admin?.active) return res.status(401).json({ message: 'La sesión no es válida.' });
    req.sportsAdmin = admin;
    return next();
  } catch {
    return res.status(401).json({ message: 'La sesión expiró o no es válida.' });
  }
};

export const createSportsSession = admin => jwt.sign({ sub: String(admin._id), type: 'sports-admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
export const sportsCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 12 * 60 * 60 * 1000, path: '/' };
