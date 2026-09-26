import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notification.controller.js';

const router = Router();

// =============================================================================
// Notification Routes — All protected with verifyToken
// =============================================================================

// GET /api/notifications
router.get('/', verifyToken, getNotifications);

// PATCH /api/notifications/mark-all-read (Note: must be before /:id/read)
router.patch('/mark-all-read', verifyToken, markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', verifyToken, markAsRead);

// DELETE /api/notifications/:id
router.delete('/:id', verifyToken, deleteNotification);

export default router;
