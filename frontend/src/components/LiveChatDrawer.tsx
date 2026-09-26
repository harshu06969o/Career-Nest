// src/components/LiveChatDrawer.tsx
// Elite-Grade 1-on-1 Real-time Chat Drawer for Students & Recruiters
// Benchmarked against Internshala, LinkedIn Recruiter & Wellfound
// Powered by Socket.io: live streaming, presence dots, typing indicators, read receipts, and URL parsing.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Check,
  CheckCheck,
  Briefcase,
  ChevronLeft,
  Circle,
  Sparkles,
  ExternalLink,
  FileText,
  Smile,
  ShieldCheck,
} from 'lucide-react';
import api from '../lib/axios';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { playNotificationChime } from './NotificationBell';

export interface ChatSender {
  id: string;
  email: string;
  role: 'STUDENT' | 'RECRUITER' | 'ADMIN';
  studentProfile?: { firstName: string; lastName: string } | null;
  recruiterProfile?: { companyName: string; designation: string } | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  sender?: ChatSender;
}

export interface ConversationItem {
  id: string;
  applicationId: string;
  recruiterId: string;
  studentId: string;
  createdAt: string;
  updatedAt: string;
  application: {
    id: string;
    status: string;
    matchScore: number | null;
    job: {
      id: string;
      title: string;
      recruiter: {
        id: string;
        email: string;
        recruiterProfile?: { companyName: string; designation: string } | null;
      };
    };
    student: {
      id: string;
      firstName: string;
      lastName: string;
      college: string;
      cgpa: number;
      resumeUrl: string | null;
      user: { id: string; email: string };
    };
  };
  messages: ChatMessage[];
  _count: { messages: number };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialConversationId?: string | null;
}

// Format message content with clickable URLs
function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, idx) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-indigo-300 hover:text-white font-medium break-all transition-colors inline-flex items-center gap-0.5"
        >
          {part}
          <ExternalLink size={10} className="inline ml-0.5" />
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

// Group date separators
function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const QUICK_EMOJIS = ['👍', '🤝', '🎯', '🎉', '📅', '🚀', '💡'];

export default function LiveChatDrawer({ isOpen, onClose, initialConversationId }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const currentUserRole = useAuthStore((s) => s.user?.role);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch all conversations for current user
  const fetchConversations = async () => {
    try {
      setLoadingConv(true);
      const res = await api.get<{ success: boolean; data: ConversationItem[] }>('/chat/conversations');
      if (res.data.success) {
        setConversations(res.data.data);
      }
    } catch (err) {
      console.warn('[LiveChatDrawer] Failed to fetch conversations:', err);
    } finally {
      setLoadingConv(false);
    }
  };

  // Fetch single conversation details if not yet in state
  const fetchSingleConversation = async (convId: string) => {
    try {
      const res = await api.get<{ success: boolean; data: ConversationItem }>(`/chat/conversations/${convId}`);
      if (res.data.success && res.data.data) {
        setConversations((prev) => {
          if (prev.some((c) => c.id === convId)) {
            return prev.map((c) => (c.id === convId ? res.data.data : c));
          }
          return [res.data.data, ...prev];
        });
      }
    } catch (err) {
      console.warn('[LiveChatDrawer] Failed to fetch single conversation:', err);
    }
  };

  // Fetch messages for active conversation
  const fetchMessages = async (convId: string) => {
    try {
      setLoadingMsg(true);
      const res = await api.get<{ success: boolean; data: ChatMessage[] }>(`/chat/conversations/${convId}/messages`);
      if (res.data.success) {
        setMessages(res.data.data);
        setTimeout(() => scrollToBottom('auto'), 80);
      }
    } catch (err) {
      console.warn('[LiveChatDrawer] Failed to load messages:', err);
    } finally {
      setLoadingMsg(false);
    }
  };

  // Initial load when opened
  useEffect(() => {
    if (isOpen) {
      void fetchConversations();
      if (initialConversationId) {
        setActiveConvId(initialConversationId);
        void fetchSingleConversation(initialConversationId);
      }
    }
  }, [isOpen, initialConversationId]);

  // When active conversation changes, load messages, join room & auto-focus input
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    void fetchMessages(activeConvId);

    // If conversation not in list, fetch it
    if (!conversations.some((c) => c.id === activeConvId)) {
      void fetchSingleConversation(activeConvId);
    }

    const socket = getSocket();
    socket.emit('chat:join', { conversationId: activeConvId });
    socket.emit('chat:mark_read', { conversationId: activeConvId });

    // Mark unread count as 0 locally
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, _count: { messages: 0 } } : c)),
    );

    setTimeout(() => inputRef.current?.focus(), 150);

    return () => {
      socket.emit('chat:leave', { conversationId: activeConvId });
    };
  }, [activeConvId]);

  // Active conversation metadata
  const currentConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId),
    [conversations, activeConvId],
  );

  const peerDetails = useMemo(() => {
    if (!currentConversation) return null;
    const isStudent = currentUserRole === 'STUDENT';
    if (isStudent) {
      const recruiterName =
        currentConversation.application.job.recruiter.recruiterProfile?.companyName ??
        currentConversation.application.job.recruiter.email;
      const subtitle = currentConversation.application.job.title;
      const peerId = currentConversation.recruiterId;
      const matchScore = currentConversation.application.matchScore;
      return {
        name: recruiterName,
        subtitle,
        peerId,
        isOnline: onlineUsers.has(peerId),
        matchScore,
        resumeUrl: null,
      };
    } else {
      const studentName =
        `${currentConversation.application.student.firstName} ${currentConversation.application.student.lastName}`.trim() ||
        currentConversation.application.student.user.email;
      const subtitle = `${currentConversation.application.job.title} · ${currentConversation.application.student.college}`;
      const peerId = currentConversation.studentId;
      const matchScore = currentConversation.application.matchScore;
      const resumeUrl = currentConversation.application.student.resumeUrl;
      return {
        name: studentName,
        subtitle,
        peerId,
        isOnline: onlineUsers.has(peerId),
        matchScore,
        resumeUrl,
      };
    }
  }, [currentConversation, currentUserRole, onlineUsers]);

  // Query presence immediately when peerId is discovered
  useEffect(() => {
    if (!peerDetails?.peerId) return;
    const socket = getSocket();
    socket.emit('presence:query', { userIds: [peerDetails.peerId] }, (res: Record<string, boolean>) => {
      if (res && res[peerDetails.peerId]) {
        setOnlineUsers((prev) => new Set(prev).add(peerDetails.peerId));
      }
    });
  }, [peerDetails?.peerId]);

  // Socket event listeners for real-time messages & typing & presence
  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.conversationId === activeConvId) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        scrollToBottom('smooth');
        if (msg.senderId !== currentUserId) {
          playNotificationChime();
          socket.emit('chat:mark_read', { conversationId: activeConvId });
        }
      } else {
        // Increment unread count in conversations list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId
              ? { ...c, messages: [msg], _count: { messages: (c._count?.messages ?? 0) + 1 } }
              : c,
          ),
        );
        if (msg.senderId !== currentUserId) {
          playNotificationChime();
        }
      }
    };

    const handlePeerTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data.conversationId === activeConvId && data.userId !== currentUserId) {
        setPeerTyping(data.isTyping);
      }
    };

    const handleReadReceipt = (data: { conversationId: string; readBy: string; readAt: string }) => {
      if (data.conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId ? { ...m, isRead: true, readAt: data.readAt } : m,
          ),
        );
      }
    };

    const handlePresenceUpdate = (data: { userId: string; isOnline: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.isOnline) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:peer_typing', handlePeerTyping);
    socket.on('chat:read_receipt', handleReadReceipt);
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:peer_typing', handlePeerTyping);
      socket.off('chat:read_receipt', handleReadReceipt);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [activeConvId, currentUserId]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!activeConvId) return;

    const socket = getSocket();
    socket.emit('chat:typing', { conversationId: activeConvId, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { conversationId: activeConvId, isTyping: false });
    }, 1500);
  };

  // Send message
  const handleSendMessage = async (customContent?: string) => {
    const textToSend = (customContent ?? inputValue).trim();
    if (!textToSend || !activeConvId || sending) return;

    setSending(true);
    try {
      const res = await api.post<{ success: boolean; data: ChatMessage }>(
        `/chat/conversations/${activeConvId}/messages`,
        { content: textToSend },
      );
      if (res.data.success) {
        if (!customContent) setInputValue('');
        setShowEmojiPicker(false);
        const socket = getSocket();
        socket.emit('chat:typing', { conversationId: activeConvId, isTyping: false });
        // The message will also arrive via socket, but if not yet appended, append it:
        setMessages((prev) => (prev.some((m) => m.id === res.data.data.id) ? prev : [...prev, res.data.data]));
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    } catch (err) {
      console.error('[LiveChatDrawer] Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  // Messages grouped with date markers
  const messageGroups = useMemo(() => {
    const groups: { date: string; items: ChatMessage[] }[] = [];
    messages.forEach((msg) => {
      const dateKey = formatDateSeparator(msg.createdAt);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateKey) {
        lastGroup.items.push(msg);
      } else {
        groups.push({ date: dateKey, items: [msg] });
      }
    });
    return groups;
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div
        className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300"
        style={{ boxShadow: '-12px 0 40px -5px rgba(0,0,0,0.8)' }}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800/90 bg-slate-900/95 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {activeConvId && (
              <button
                type="button"
                onClick={() => setActiveConvId(null)}
                className="p-1.5 -ml-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                title="Back to conversations"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="min-w-0">
              {peerDetails ? (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="font-bold text-white text-sm truncate max-w-[200px]"
                      style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
                    >
                      {peerDetails.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        peerDetails.isOnline
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-slate-400 bg-slate-800 border-slate-700'
                      }`}
                    >
                      <Circle
                        size={5}
                        className={peerDetails.isOnline ? 'fill-emerald-400 animate-pulse' : 'fill-slate-500'}
                      />
                      {peerDetails.isOnline ? 'Online' : 'Offline'}
                    </span>
                    {peerDetails.matchScore !== null && (
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                        {peerDetails.matchScore}% Match
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{peerDetails.subtitle}</p>
                </div>
              ) : (
                <div>
                  <h2 className="font-bold text-white text-base flex items-center gap-2" style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}>
                    <MessageSquare size={17} className="text-indigo-400" />
                    Messages
                  </h2>
                  <p className="text-xs text-slate-400">Direct 1-on-1 recruiter channels</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Quick Resume Link for Recruiter */}
            {peerDetails?.resumeUrl && (
              <a
                href={peerDetails.resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
                title="Open Candidate's Resume"
              >
                <FileText size={12} />
                <span>Resume</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!activeConvId ? (
          /* Conversation List */
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2">
            {loadingConv ? (
              <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Syncing conversations…</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-24 text-center px-6 animate-in fade-in duration-300">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                  <MessageSquare size={26} />
                </div>
                <h3 className="font-bold text-white text-sm mb-1.5">No Active Chats Yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {currentUserRole === 'RECRUITER'
                    ? 'Shortlist a candidate to unlock a private live chat channel with them!'
                    : 'Once a recruiter shortlists your application, your live chat channel will appear here!'}
                </p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                  <ShieldCheck size={12} className="text-emerald-400" />
                  <span>Real-time End-to-End WebSocket Channel</span>
                </div>
              </div>
            ) : (
              conversations.map((conv) => {
                const isStudent = currentUserRole === 'STUDENT';
                const name = isStudent
                  ? conv.application.job.recruiter.recruiterProfile?.companyName || conv.application.job.recruiter.email
                  : `${conv.application.student.firstName} ${conv.application.student.lastName}`.trim() ||
                    conv.application.student.user.email;
                const jobTitle = conv.application.job.title;
                const lastMsg = conv.messages[0];
                const unread = conv._count?.messages ?? 0;
                const peerId = isStudent ? conv.recruiterId : conv.studentId;
                const isOnline = onlineUsers.has(peerId);

                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className="p-3.5 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-sm flex-shrink-0 shadow-sm">
                        {name.charAt(0).toUpperCase()}
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-100 truncate group-hover:text-indigo-300 transition-colors">
                            {name}
                          </p>
                          <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 truncate">
                            {jobTitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {lastMsg ? lastMsg.content : 'Chat channel unlocked. Say hello!'}
                        </p>
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[11px] font-bold shadow-md shadow-indigo-500/30 flex-shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* Active Chat Room View */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40">
            {/* Quick Chips for fast professional interaction */}
            <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1 flex-shrink-0">
                <Sparkles size={11} className="text-indigo-400" />
                Quick:
              </span>
              {(currentUserRole === 'RECRUITER'
                ? [
                    'Hi! We loved your profile.',
                    'When are you free for a call?',
                    'Here is our assignment repository.',
                    'Could you share your GitHub link?',
                  ]
                : [
                    'Thank you for shortlisting me!',
                    'I am available for an interview this week.',
                    'Here is my portfolio & project link.',
                    'Happy to answer any technical questions!',
                  ]
              ).map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSendMessage(chip)}
                  className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 text-[11px] font-medium border border-slate-700/60 hover:border-indigo-500/40 transition-colors whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMsg ? (
                <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to secure chat channel…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center animate-in fade-in duration-300">
                  <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-2">
                    <Briefcase size={22} />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">Private hiring channel established</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                    Say hello to discuss role expectations, project assignments, or interview timings.
                  </p>
                </div>
              ) : (
                messageGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-3">
                    {/* Date Divider */}
                    <div className="flex items-center justify-center my-3">
                      <span className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-semibold text-slate-400 uppercase tracking-wider shadow-sm">
                        {group.date}
                      </span>
                    </div>

                    {group.items.map((msg) => {
                      const isMine = msg.senderId === currentUserId;
                      const time = new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm break-words transition-all ${
                              isMine
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-indigo-600/20'
                                : 'bg-slate-800 border border-slate-700/60 text-slate-100 rounded-tl-none shadow-slate-900/30'
                            }`}
                          >
                            <div>{renderMessageContent(msg.content)}</div>
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                                isMine ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            >
                              <span>{time}</span>
                              {isMine &&
                                (msg.isRead ? (
                                  <span title="Read">
                                    <CheckCheck size={12} className="text-sky-300 font-bold" />
                                  </span>
                                ) : (
                                  <span title="Sent">
                                    <Check size={12} className="text-indigo-200" />
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Peer typing indicator */}
              {peerTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs pl-1 animate-in fade-in duration-150">
                  <div className="flex gap-1 items-center bg-slate-800/90 px-3 py-1.5 rounded-full border border-slate-700/60 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-1.5 text-[11px] font-medium text-slate-300">typing…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Emoji Bar (Toggled) */}
            {showEmojiPicker && (
              <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-2 duration-150">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">React:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputValue((prev) => prev + emoji);
                      inputRef.current?.focus();
                    }}
                    className="p-1 hover:bg-slate-800 rounded text-sm transition-transform active:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    showEmojiPicker
                      ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border-slate-700/80'
                  }`}
                  title="Emoji"
                >
                  <Smile size={16} />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Press Enter to send)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  disabled={!inputValue.trim() || sending}
                  onClick={() => void handleSendMessage()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-600/30 flex-shrink-0 active:scale-95"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
