/**
 * @file chatStore.ts
 * @description Centralized Zustand state management store for the Live 1-on-1 Chat Drawer.
 * Decouples chat UI triggers from drawer implementation, enabling arbitrary components
 * (Navbar, ApplicantRows, MatchCards, Notification Bell popover) to programmatically open
 * or navigate to conversation channels without prop drilling.
 */

import { create } from 'zustand';

interface ChatStoreState {
  /** Controls drawer slide-in visibility. */
  isOpen: boolean;
  /** Active conversation channel ID to load immediately upon opening. */
  activeConversationId: string | null;
  /**
   * Opens the chat drawer, optionally focusing a specific conversation room.
   * @param conversationId - Optional conversation UUID. If omitted, opens the channel list.
   */
  openChat: (conversationId?: string | null) => void;
  /** Closes the chat drawer and resets the active conversation pointer. */
  closeChat: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  isOpen: false,
  activeConversationId: null,
  openChat: (conversationId = null) =>
    set({ isOpen: true, activeConversationId: conversationId }),
  closeChat: () => set({ isOpen: false, activeConversationId: null }),
}));
