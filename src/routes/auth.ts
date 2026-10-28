import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { authenticate, signToken } from '../auth.js';
import { db } from '../db.js';
import { ApiError, parse } from '../http.js';
import { loginSchema } from '../schemas.js';

export const authRoutes = Router();

authRoutes.post('/login', (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;
  // Same error for unknown email and wrong password: don't reveal which accounts exist.
  if (!u || !bcrypt.compareSync(password, u.password_hash)) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  const user = { id: u.id, role: u.role, name: u.name };
  res.json({ token: signToken(user), user });
});

authRoutes.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
