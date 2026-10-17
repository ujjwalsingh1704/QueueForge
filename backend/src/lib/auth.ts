import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthedRequest extends Request {
  userId: number;
}

export const signSession = (userId: number) => jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: "7d" });

export function readUserId(req: Request): number | null {
  const token = req.cookies?.token;
  if (!token) return null;
  try {
    return (jwt.verify(token, config.jwtSecret) as { uid: number }).uid;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const uid = readUserId(req);
  if (!uid) return res.status(401).json({ error: "Not signed in" });
  (req as AuthedRequest).userId = uid;
  next();
}
