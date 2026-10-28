import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Router } from "express";
import { authenticate, signToken } from "../auth.js";
import { db } from "../db.js";
import { ApiError, parse } from "../http.js";
import { loginSchema, signupSchema } from "../schemas.js";

export const authRoutes = Router();

authRoutes.post("/login", (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const u = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase()) as any;
  // Same error for unknown email and wrong password: don't reveal which accounts exist.
  if (!u || !bcrypt.compareSync(password, u.password_hash))
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Incorrect email or password",
    );
  const user = { id: u.id, role: u.role, name: u.name };
  res.json({ token: signToken(user), user });
});

authRoutes.post("/signup", (req, res) => {
  const input = parse(signupSchema, req.body);
  const email = input.email.toLowerCase();
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    throw new ApiError(
      409,
      "EMAIL_EXISTS",
      "An account with this email already exists",
    );
  const user = {
    id: `AUTH-${crypto.randomUUID()}`,
    role: "author" as const,
    name: input.name,
  };
  db.prepare(
    "INSERT INTO users (id,email,password_hash,role,name) VALUES (?,?,?,?,?)",
  ).run(
    user.id,
    email,
    bcrypt.hashSync(input.password, 12),
    user.role,
    user.name,
  );
  res.status(201).json({ token: signToken(user), user });
});

authRoutes.get("/me", authenticate, (req, res) => res.json({ user: req.user }));
