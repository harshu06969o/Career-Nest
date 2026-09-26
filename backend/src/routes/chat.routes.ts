import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
} from '../controllers/chat.controller.js';

const router = Router();

// =============================================================================
// Chat Routes — All protected with verifyToken
// =============================================================================

// GET /api/chat/conversations
router.get('/conversations', verifyToken, getConversations);

// GET /api/chat/conversations/:conversationId
router.get('/conversations/:conversationId', verifyToken, getConversationById);

// GET /api/chat/conversations/:conversationId/messages
router.get('/conversations/:conversationId/messages', verifyToken, getMessages);

// POST /api/chat/conversations/:conversationId/messages
router.post('/conversations/:conversationId/messages', verifyToken, sendMessage);

export default router;
