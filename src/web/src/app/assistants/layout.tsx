'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../../components/layout/Navigation';
import Header from '../../../components/layout/Header';
import Sidebar from '../../../components/layout/Sidebar';
import { useAuth } from '../../../hooks/useAuth';
import { UI_CONSTANTS } from '../../../config/constants';

// Interface for layout props
interface AssistantsLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component for the assistants section implementing secure access control
 * and responsive design following the technical specifications
 */
const AssistantsLayout: React.FC<AssistantsLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  // Validate user session and role access
  useEffect(() => {
    setIsMounted(true);

    // Redirect to login if not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    // Validate role-based access
    if (!isLoading && user && !['admin', 'manager'].includes(user.role.toLowerCase())) {
      router.push('/dashboard');
      return;
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Monitor session activity and timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      // Update last activity timestamp in auth store
      useAuth.getState().updateActivity();
    };

    // Monitor user activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [isAuthenticated]);

  // Don't render until client-side hydration is complete
  if (!isMounted) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Main layout structure
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with user profile */}
        <Header 
          className="border-b border-gray-200 dark:border-gray-800"
          ariaLabel="Assistants section header"
        />

        {/* Main content with responsive padding */}
        <main 
          className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8"
          style={{
            marginTop: UI_CONSTANTS.SPACING.XL, // Header height
            marginLeft: UI_CONSTANTS.SPACING.XL, // Sidebar width
          }}
        >
          {/* Role-based content rendering */}
          {isAuthenticated && ['admin', 'manager'].includes(user?.role.toLowerCase() || '') ? (
            children
          ) : null}
        </main>
      </div>

      {/* Mobile navigation */}
      <div className="lg:hidden">
        <Navigation className="fixed bottom-0 left-0 right-0 z-50" />
      </div>
    </div>
  );
};

export default AssistantsLayout;