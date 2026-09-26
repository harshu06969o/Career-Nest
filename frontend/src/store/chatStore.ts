// src/store/chatStore.ts
// Global state management for Live 1-on-1 Chat Drawer across the application

import { create } from 'zustand';

interface ChatStoreState {
  isOpen: boolean;
  activeConversationId: string | null;
  openChat: (conversationId?: string | null) => void;
  closeChat: () => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  isOpen: false,
  activeConversationId: null,
  openChat: (conversationId = null) =>
    set({ isOpen: true, activeConversationId: conversationId }),
  closeChat: () => set({ isOpen: false, activeConversationId: null }),
}));
