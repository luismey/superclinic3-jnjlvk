'use client';

import React, { useState, useEffect } from 'react';
import { redirect } from 'next/navigation';
import cn from 'classnames';

import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/common';

// Constants for responsive breakpoints
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
};

// Interface for layout props
interface AnalyticsLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component for analytics pages with authentication, authorization,
 * and responsive behavior following the design system specifications.
 */
const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = ({ children }) => {
  // Authentication state
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Sidebar state for responsive behavior
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login');
    }

    // Verify user has analytics access (Admin or Manager only)
    if (user && ![UserRole.ADMIN, UserRole.MANAGER].includes(user.role as UserRole)) {
      redirect('/dashboard');
    }
  }, [isAuthenticated, isLoading, user]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const mobile = width < BREAKPOINTS.mobile;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };

    // Initial check
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Handle menu toggle for mobile
  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header 
        className="fixed top-0 left-0 right-0 z-50"
        onMenuClick={handleMenuToggle}
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        navItems={[
          { path: '/analytics/overview', label: 'Overview' },
          { path: '/analytics/messages', label: 'Message Analytics' },
          { path: '/analytics/campaigns', label: 'Campaign Performance' },
          { path: '/analytics/assistants', label: 'Assistant Metrics' },
        ]}
      />

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-300 ease-in-out',
          'pt-16', // Header height
          {
            'ml-64': isSidebarOpen && !isMobile, // Sidebar width
            'ml-0': !isSidebarOpen || isMobile,
          },
          'px-4 py-6 md:px-6 lg:px-8', // Responsive padding
          'min-h-screen'
        )}
      >
        {/* Mobile sidebar backdrop */}
        {isMobile && isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Page content */}
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsLayout;