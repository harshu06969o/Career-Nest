import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

// POST /api/auth/register
// Body: { email: string, password: string, role: 'STUDENT' | 'RECRUITER' }
router.post('/register', register);

// POST /api/auth/login
// Body: { email: string, password: string }
// Returns: { token: string, user: { userId, email, role } }
router.post('/login', login);

export default router;
