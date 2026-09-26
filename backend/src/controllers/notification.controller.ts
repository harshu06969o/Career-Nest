import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';

// =============================================================================
// resolveParam — narrows Express params (string | string[]) → string
// =============================================================================
function resolveParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

/**
 * Returns latest 30 notifications for the logged-in user, along with the total unreadCount.
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
    console.error('[getNotifications] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

/**
 * Marks a specific notification as read.
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
    console.error('[markAsRead] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
};

/**
 * Marks all unread notifications for the user as read.
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
    console.error('[markAllAsRead] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};

/**
 * Deletes a specific notification for the user.
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
    console.error('[deleteNotification] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
};

