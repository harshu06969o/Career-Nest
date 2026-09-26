/**
 * @file NotificationBell.tsx
 * @description Real-Time In-App Notification Center & Popover.
 * Synchronizes incoming system and hiring events live via Socket.io,
 * synthesizes acoustic notifications via the Web Audio API,
 * and enables instantaneous unread filtering, batch read, and dismissal.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Sparkles,
  XCircle,
  FileText,
  MessageSquare,
  ExternalLink,
  Trash2,
  Check,
} from 'lucide-react';
import api from '../lib/axios';
import { getSocket } from '../lib/socket';
import { useChatStore } from '../store/chatStore';

export interface AppNotification {
  id: string;
  type:
    | 'APPLICATION_SHORTLISTED'
    | 'APPLICATION_REJECTED'
    | 'NEW_APPLICATION_RECEIVED'
    | 'NEW_CHAT_MESSAGE'
    | 'CAMPUS_ANNOUNCEMENT';
  title: string;
  message: string;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

// Synthesizes a clean two-tone chime (D5 -> A5) without external audio file assets
export function playNotificationChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Autoplay policy or unsupported audio environment — gracefully ignore
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface Props {
  onOpenChat?: (conversationId?: string) => void;
  className?: string;
}

export default function NotificationBell({ onOpenChat, className = '' }: Props) {
  const navigate = useNavigate();
  const openChatFromStore = useChatStore((s) => s.openChat);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from REST API
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get<{
        success: boolean;
        data: { notifications: AppNotification[]; unreadCount: number };
      }>('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data.notifications);
        setUnreadCount(res.data.data.unreadCount);
      }
    } catch (err) {
      console.warn('[NotificationBell] Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();

    // Listen to real-time notifications via Socket.io
    const socket = getSocket();
    const handleNewNotification = (notif: AppNotification) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      setUnreadCount((prev) => prev + 1);
      playNotificationChime();
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = async (notif: AppNotification) => {
    // Mark as read if not already
    if (!notif.isRead) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('[NotificationBell] Failed to mark notification as read:', err);
      }
    }

    setIsOpen(false);

    // If notification has a conversation link, open live chat
    if (notif.linkUrl?.includes('conversationId=')) {
      const match = notif.linkUrl.match(/conversationId=([^&]+)/);
      if (match?.[1]) {
        if (onOpenChat) {
          onOpenChat(match[1]);
        } else {
          openChatFromStore(match[1]);
        }
        return;
      }
    }

    // Otherwise navigate to destination URL if present
    if (notif.linkUrl) {
      navigate(notif.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationBell] Failed to mark all as read:', err);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target && !target.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.error('[NotificationBell] Failed to delete notification:', err);
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'APPLICATION_SHORTLISTED':
        return <Sparkles size={16} className="text-emerald-400 flex-shrink-0" />;
      case 'APPLICATION_REJECTED':
        return <XCircle size={16} className="text-rose-400 flex-shrink-0" />;
      case 'NEW_APPLICATION_RECEIVED':
        return <FileText size={16} className="text-indigo-400 flex-shrink-0" />;
      case 'NEW_CHAT_MESSAGE':
        return <MessageSquare size={16} className="text-sky-400 flex-shrink-0" />;
      default:
        return <Bell size={16} className="text-amber-400 flex-shrink-0" />;
    }
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) void fetchNotifications();
        }}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell size={19} className={unreadCount > 0 ? 'text-indigo-600 animate-wiggle' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white shadow-md shadow-indigo-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 30px rgba(99,102,241,0.15)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="font-bold text-white text-sm"
                style={{ fontFamily: 'Plus Jakarta Sans, Inter, sans-serif' }}
              >
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                title="Mark all notifications as read"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  filter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                  filter === 'unread'
                    ? 'bg-slate-800 text-indigo-300 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Real-time sync</span>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {loading && notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading notifications…</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 text-center px-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500">
                  <Bell size={20} />
                </div>
                <p className="text-xs font-semibold text-slate-300">
                  {filter === 'unread' ? 'No unread notifications' : 'All caught up!'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {filter === 'unread'
                    ? 'You have read all your notifications.'
                    : 'New alerts, shortlisted statuses, and chat messages will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => void handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-all group ${
                    notif.isRead
                      ? 'hover:bg-slate-800/40 opacity-75 hover:opacity-100'
                      : 'bg-indigo-500/5 hover:bg-indigo-500/15 border-l-2 border-indigo-500'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-700/60 mt-0.5 flex-shrink-0 shadow-sm">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p
                        className={`text-xs font-bold truncate ${
                          notif.isRead ? 'text-slate-300' : 'text-white'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.linkUrl && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 mt-1 hover:text-indigo-300">
                        {notif.linkUrl.includes('conversationId=') ? 'Open live chat' : 'View details'}
                        <ExternalLink size={10} />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                    {!notif.isRead ? (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
                    ) : (
                      <Check size={12} className="text-slate-600" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteNotification(e, notif.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-all"
                      title="Dismiss"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
