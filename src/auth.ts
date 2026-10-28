import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import type { Role } from "./domain.js";
import { ApiError } from "./http.js";

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const signToken = (u: AuthUser) =>
  jwt.sign(u, config.jwtSecret, { expiresIn: "12h" });

export function verifyToken(token: string): AuthUser {
  try {
    const p = jwt.verify(token, config.jwtSecret) as AuthUser;
    return { id: p.id, role: p.role, name: p.name };
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Missing or invalid token");
  }
}

/** Every protected route goes through this: Bearer token -> req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization ?? "";
  if (!h.startsWith("Bearer "))
    return next(new ApiError(401, "UNAUTHENTICATED", "Missing bearer token"));
  try {
    req.user = verifyToken(h.slice(7));
    next();
  } catch (e) {
    next(e);
  }
}

export const requireRole =
  (role: Role) => (req: Request, _res: Response, next: NextFunction) =>
    req.user?.role === role
      ? next()
      : next(new ApiError(403, "FORBIDDEN", `${role} access only`));
