import jwt from 'jsonwebtoken';

export const generateToken = (userId, isAdmin) => {
  return jwt.sign(
    { userId, isAdmin }, // ✅ Incluimos isAdmin en el payload del token
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // ⏰ Puedes ajustar este tiempo si lo deseas
  );
};
