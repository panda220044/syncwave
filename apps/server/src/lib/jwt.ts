import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface JwtPayload {
  userId: string;
  displayName: string;
  token: string; // anonymous session token
}

const signOptions: SignOptions = { expiresIn: '7d' };

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
