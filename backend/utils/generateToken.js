import jwt from 'jsonwebtoken';

export const generateToken = (userId, role, isAdmin) => {
  return jwt.sign(
    { userId, role, isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};
