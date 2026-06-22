import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db';
import { signToken } from '../lib/jwt';

const router = Router();

router.post('/join', (req: Request, res: Response) => {
  try {
    const { displayName } = req.body as { displayName?: string };
    if (!displayName?.trim()) {
      res.status(400).json({ success: false, error: 'Display name is required' });
      return;
    }

    const name = displayName.trim().slice(0, 32);
    const id = uuidv4();
    const sessionToken = uuidv4();

    db.prepare(
      'INSERT INTO User (id, displayName, token) VALUES (?, ?, ?)'
    ).run(id, name, sessionToken);

    const jwt = signToken({ userId: id, displayName: name, token: sessionToken });
    res.json({ success: true, data: { token: jwt, userId: id, displayName: name } });
  } catch (error) {
    console.error('[Auth] Join error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
