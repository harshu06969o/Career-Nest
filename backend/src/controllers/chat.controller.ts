/**
 * @file chat.controller.ts
 * @description Controller managing 1-on-1 real-time recruiter ↔ candidate communication channels.
 * Enforces participant authorization, bidirectional message persistence, unread counters,
 * and multi-channel notification dispatch.
 *
 * @architecture
 * - Invariant: A conversation exists if and only if an application has been transitioned to SHORTLISTED.
 * - Authorization: Every operation strictly verifies that `req.user.userId` equals either `recruiterId` or `studentId`.
 * - Event Dispatch: Combines Socket.io room broadcasting with discrete user-targeted alerts for offline/cross-page synchronization.
 */

import type { Request, Response } from 'express';
import prisma from '../config/prismaClient.js';
import { getIO, emitToUser } from '../config/socketServer.js';

/**
 * Normalizes an Express route parameter to a single trimmed string.
 * @param param - Route parameter from `req.params`.
 */
function resolveParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

/**
 * Retrieves all active conversations for the authenticated user (Student or Recruiter).
 * Aggregates latest message snippet and calculates unread count strictly for incoming messages.
 *
 * @route GET /api/chat/conversations
 * @access Protected (JWT)
 */
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ recruiterId: userId }, { studentId: userId }],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            matchScore: true,
            job: {
              select: {
                id: true,
                title: true,
                recruiter: {
                  select: {
                    id: true,
                    email: true,
                    recruiterProfile: {
                      select: { companyName: true, designation: true },
                    },
                  },
                },
              },
            },
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                college: true,
                cgpa: true,
                resumeUrl: true,
                user: {
                  select: { id: true, email: true },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                isRead: false,
              },
            },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('[getConversations] Database query failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
  }
};

/**
 * Fetches a single conversation by ID with complete candidate and job context.
 *
 * @route GET /api/chat/conversations/:conversationId
 * @access Protected (Participant Only)
 */
export const getConversationById = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const conversationId = resolveParam(req.params['conversationId']);

  if (!conversationId) {
    res.status(400).json({ success: false, message: 'conversationId parameter is required.' });
    return;
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        application: {
          select: {
            id: true,
            status: true,
            matchScore: true,
            job: {
              select: {
                id: true,
                title: true,
                recruiter: {
                  select: {
                    id: true,
                    email: true,
                    recruiterProfile: {
                      select: { companyName: true, designation: true },
                    },
                  },
                },
              },
            },
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                college: true,
                cgpa: true,
                resumeUrl: true,
                user: {
                  select: { id: true, email: true },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                senderId: { not: userId },
                isRead: false,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    if (conversation.recruiterId !== userId && conversation.studentId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden. You are not a participant in this conversation.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('[getConversationById] Database query failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversation.' });
  }
};

/**
 * Retrieves chronological message history for a conversation.
 * Enforces participant authorization and returns sender profiles for avatar rendering.
 *
 * @route GET /api/chat/conversations/:conversationId/messages
 * @access Protected (Participant Only)
 */
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const conversationId = resolveParam(req.params['conversationId']);

  if (!conversationId) {
    res.status(400).json({ success: false, message: 'conversationId parameter is required.' });
    return;
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        recruiterId: true,
        studentId: true,
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    if (conversation.recruiterId !== userId && conversation.studentId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view messages in this conversation.',
      });
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
            studentProfile: { select: { firstName: true, lastName: true } },
            recruiterProfile: { select: { companyName: true, designation: true } },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('[getMessages] Message history retrieval failed:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
};

/**
 * Persists a new message to PostgreSQL, advances the conversation timestamp,
 * broadcasts in real-time via Socket.io to the room, and logs an in-app notification.
 *
 * @route POST /api/chat/conversations/:conversationId/messages
 * @access Protected (Participant Only)
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized.' });
    return;
  }

  const { userId } = req.user;
  const conversationId = resolveParam(req.params['conversationId']);
  const { content } = req.body as { content?: string };

  if (!conversationId || !content?.trim()) {
    res.status(400).json({ success: false, message: 'conversationId and content are required.' });
    return;
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        application: {
          select: {
            job: { select: { title: true } },
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({ success: false, message: 'Conversation not found.' });
      return;
    }

    if (conversation.recruiterId !== userId && conversation.studentId !== userId) {
      res.status(403).json({
        success: false,
        message: 'Forbidden. You are not a participant in this conversation.',
      });
      return;
    }

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
            studentProfile: { select: { firstName: true, lastName: true } },
            recruiterProfile: { select: { companyName: true, designation: true } },
          },
        },
      },
    });

    // Advance conversation updatedAt timestamp for recency sorting
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId = conversation.recruiterId === userId ? conversation.studentId : conversation.recruiterId;

    // Provision an in-app notification for the recipient
    const senderRole = req.user.role === 'RECRUITER' ? 'Recruiter' : 'Candidate';
    const notif = await prisma.notification.create({
      data: {
        userId: recipientId,
        type: 'NEW_CHAT_MESSAGE',
        title: `💬 New message from ${senderRole}`,
        message: content.trim().length > 60 ? `${content.trim().slice(0, 57)}...` : content.trim(),
        linkUrl: req.user.role === 'RECRUITER'
          ? `/student/dashboard?conversationId=${conversationId}`
          : `/recruiter/dashboard?conversationId=${conversationId}`,
      },
    });

    // Broadcast live to room subscribers
    try {
      const io = getIO();
      io.to(`conversation:${conversationId}`).emit('chat:message', message);
    } catch (ioErr) {
      console.warn('[sendMessage] Socket broadcast skipped (server offline):', ioErr);
    }

    // Direct event dispatch for global notification badge increment
    emitToUser(recipientId, 'notification:new', notif);
    emitToUser(recipientId, 'chat:unread_increment', { conversationId });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('[sendMessage] Persistence failed:', error);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
};
