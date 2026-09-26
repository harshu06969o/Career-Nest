/**
 * @file notification.controller.ts
 * @description In-App Notification Hub controller.
 * Powers real-time alert aggregation, read-state transitions, batch clearance,
 * and individual item dismissal for Students, Recruiters, and Platform Admins.
 *
 * @architecture
 * - Scoping: All operations strictly scope mutations and queries to `req.user.userId`.
 * - Query Efficiency: Combines indexed retrieval (`[userId, isRead]` index in PostgreSQL)
 *   with concurrent total unread count calculation via `Promise.all`.
 */

import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';

/**
 * Normalizes an Express route parameter to a single trimmed string.
 * @param param - Route parameter from `req.params`.
 */
function resolveParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

/**
 * Retrieves the latest 30 notifications for the authenticated user and computes unread count.
 *
 * @route GET /api/notifications
 * @access Protected (JWT)
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('[getNotifications] Query failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

/**
 * Marks a specific notification as read.
 *
 * @route PATCH /api/notifications/:id/read
 * @access Protected (Owner Only)
 */
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const id = resolveParam(req.params['id']);

  if (!id) {
    res.status(400).json({ success: false, message: 'Notification ID is required.' });
    return;
  }

  try {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('[markAsRead] State transition failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

/**
 * Marks all unread notifications for the user as read.
 *
 * @route PATCH /api/notifications/mark-all-read
 * @access Protected (Owner Only)
 */
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('[markAllAsRead] Batch update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};

/**
 * Permanently dismisses/deletes an individual notification.
 *
 * @route DELETE /api/notifications/:id
 * @access Protected (Owner Only)
 */
export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const id = resolveParam(req.params['id']);

  if (!id) {
    res.status(400).json({ success: false, message: 'Notification ID is required.' });
    return;
  }

  try {
    await prisma.notification.deleteMany({
      where: { id, userId },
    });

    res.status(200).json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    console.error('[deleteNotification] Deletion failed:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
};
