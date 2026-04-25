import express from 'express';
import { registerEmployee, loginEmployee, getCurrentEmployee } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', registerEmployee);
router.post('/login', loginEmployee);
router.get('/me', protect, getCurrentEmployee);

export default router;
