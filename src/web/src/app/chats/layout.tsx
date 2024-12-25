'use client';

import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMediaQuery } from '@react-hook/media-query';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import ChatList from '../../components/chats/ChatList';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../config/theme';

// Constants for layout management
const MOBILE_BREAKPOINT = theme.breakpoints.tablet;
const CHAT_LIST_MIN_WIDTH = 320;
const CHAT_LIST_MAX_WIDTH = 400;
const RESIZE_DEBOUNCE = 100;

// Props interface
interface ChatsLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Custom hook for managing responsive layout state
 */
const useResponsiveLayout = () => {
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT})`);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false);
  const [chatListWidth, setChatListWidth] = useState(CHAT_LIST_MIN_WIDTH);

  return {
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    isChatListCollapsed,
    setIsChatListCollapsed,
    chatListWidth,
    setChatListWidth
  };
};

/**
 * ChatsLayout Component
 * 
 * Implements a responsive two-column layout for the chat interface with
 * collapsible panels, touch support, and comprehensive accessibility.
 */
const ChatsLayout: React.FC<ChatsLayoutProps> = React.memo(({ 
  children,
  className 
}) => {
  const { user, isAuthenticated } = useAuth();
  const {
    isMobile,
    isSidebarOpen,
    setIsSidebarOpen,
    isChatListCollapsed,
    setIsChatListCollapsed,
    chatListWidth,
    setChatListWidth
  } = useResponsiveLayout();

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Handle chat list collapse
  const handleChatListToggle = useCallback(() => {
    setIsChatListCollapsed(prev => !prev);
  }, []);

  // Handle chat list resize with debounce
  const handleChatListResize = useCallback((width: number) => {
    const newWidth = Math.max(
      CHAT_LIST_MIN_WIDTH,
      Math.min(width, CHAT_LIST_MAX_WIDTH)
    );
    setChatListWidth(newWidth);
  }, []);

  // Handle window resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (isMobile) {
          setIsSidebarOpen(false);
          setIsChatListCollapsed(true);
        }
      }, RESIZE_DEBOUNCE);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isMobile]);

  return (
    <div 
      className={clsx(
        'flex h-screen bg-gray-50 dark:bg-gray-900',
        'overflow-hidden relative',
        className
      )}
      role="main"
      aria-label="Chat interface"
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={handleSidebarToggle}
        className={clsx(
          'transition-transform duration-300',
          !isSidebarOpen && '-translate-x-full'
        )}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          onMenuClick={handleSidebarToggle}
          className="z-20 bg-white dark:bg-gray-800 border-b"
        />

        {/* Chat Container */}
        <div className="flex-1 flex overflow-hidden pt-16">
          {/* Chat List Panel */}
          <div
            className={clsx(
              'h-full bg-white dark:bg-gray-800',
              'border-r border-gray-200 dark:border-gray-700',
              'transition-all duration-300',
              isChatListCollapsed && (isMobile ? '-translate-x-full' : 'w-0')
            )}
            style={{ width: isChatListCollapsed ? 0 : chatListWidth }}
          >
            <ChatList
              onChatSelect={() => isMobile && setIsChatListCollapsed(true)}
              className="h-full"
            />
          </div>

          {/* Chat Content */}
          <div 
            className={clsx(
              'flex-1 flex flex-col overflow-hidden',
              'bg-gray-50 dark:bg-gray-900'
            )}
          >
            {children}
          </div>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {isMobile && (isSidebarOpen || !isChatListCollapsed) && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsChatListCollapsed(true);
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

ChatsLayout.displayName = 'ChatsLayout';

export default ChatsLayout;