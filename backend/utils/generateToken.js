import jwt from 'jsonwebtoken';

export const generateToken = (userId, role, isAdmin) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no esta configurada');
  }

  return jwt.sign(
    { userId, role, isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};
