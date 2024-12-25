'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { redirect } from 'next/navigation';
import cn from 'classnames';

// Internal components
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import Footer from '../../components/layout/Footer';
import { useAuth } from '../../hooks/useAuth';

// Types
interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface LayoutState {
  isSidebarCollapsed: boolean;
  isMenuOpen: boolean;
}

/**
 * Dashboard layout component implementing the application shell with authentication
 * protection, responsive behavior, and accessibility enhancements.
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  // Authentication state
  const { isAuthenticated, isLoading } = useAuth();

  // Layout state
  const [layoutState, setLayoutState] = useState<LayoutState>({
    isSidebarCollapsed: false,
    isMenuOpen: false,
  });

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback((collapsed: boolean) => {
    setLayoutState(prev => ({
      ...prev,
      isSidebarCollapsed: collapsed,
    }));

    // Persist preference
    localStorage.setItem('sidebar_collapsed', JSON.stringify(collapsed));
  }, []);

  // Handle mobile menu toggle
  const handleMenuToggle = useCallback((open: boolean) => {
    setLayoutState(prev => ({
      ...prev,
      isMenuOpen: open,
    }));
  }, []);

  // Initialize layout preferences
  useEffect(() => {
    const storedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (storedCollapsed) {
      setLayoutState(prev => ({
        ...prev,
        isSidebarCollapsed: JSON.parse(storedCollapsed),
      }));
    }
  }, []);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !layoutState.isSidebarCollapsed) {
        handleSidebarToggle(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [handleSidebarToggle, layoutState.isSidebarCollapsed]);

  // Authentication protection
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={layoutState.isSidebarCollapsed}
        onToggle={handleSidebarToggle}
        className={cn(
          'fixed inset-y-0 left-0 z-30 transition-transform duration-300',
          layoutState.isSidebarCollapsed ? '-translate-x-full md:translate-x-0' : 'translate-x-0'
        )}
      />

      {/* Main Content Area */}
      <div className={cn(
        'flex flex-col flex-1 min-h-screen',
        layoutState.isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
      )}>
        {/* Header */}
        <Header
          onMenuToggle={handleMenuToggle}
          className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800"
        />

        {/* Main Content */}
        <main 
          className={cn(
            'flex-1 px-4 py-8 overflow-auto',
            'md:px-6 lg:px-8',
            'transition-all duration-300'
          )}
          role="main"
          aria-label="Main content"
        >
          {/* Error Boundary would wrap children here in production */}
          {children}
        </main>

        {/* Footer */}
        <Footer 
          className="border-t border-gray-200 dark:border-gray-800"
        />
      </div>

      {/* Mobile Menu Overlay */}
      {layoutState.isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => handleMenuToggle(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default DashboardLayout;