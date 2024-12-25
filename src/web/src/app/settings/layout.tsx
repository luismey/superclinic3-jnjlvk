'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/layout/Header';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/common';

// Interface for layout props
interface SettingsLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout component for settings section with enhanced security and responsive design
 * Implements role-based access control and session validation
 */
const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [layoutMounted, setLayoutMounted] = useState(false);

  // Validate user session and authorization
  useEffect(() => {
    const validateAccess = async () => {
      try {
        // Wait for authentication state to be determined
        if (isLoading) return;

        // Redirect to login if not authenticated
        if (!isAuthenticated) {
          router.push('/login');
          return;
        }

        // Check if user has admin role
        const hasAccess = user?.role === UserRole.ADMIN;
        setIsAuthorized(hasAccess);

        // Redirect unauthorized users
        if (!hasAccess) {
          router.push('/dashboard');
          return;
        }

        setLayoutMounted(true);
      } catch (error) {
        console.error('Settings access validation error:', error);
        router.push('/dashboard');
      }
    };

    validateAccess();
  }, [user, isAuthenticated, isLoading, router]);

  // Show loading state while validating
  if (isLoading || !layoutMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Show unauthorized message for non-admin users
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Unauthorized Access
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          You don't have permission to access settings.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with user context */}
      <Header 
        className="fixed top-0 left-0 right-0 z-50"
        aria-label="Settings header"
      />

      {/* Navigation sidebar */}
      <Sidebar />

      {/* Main content area with responsive padding */}
      <main 
        className="flex-1 transition-all duration-200 ease-in-out"
        style={{
          marginLeft: '240px', // Sidebar width
          marginTop: '64px',   // Header height
          padding: '24px',
        }}
      >
        {/* Security context wrapper */}
        <div 
          role="region" 
          aria-label="Settings content"
          className="max-w-7xl mx-auto"
        >
          {children}
        </div>
      </main>

      {/* Responsive styles for mobile layout */}
      <style jsx>{`
        @media (max-width: 768px) {
          main {
            margin-left: 0;
            padding: 16px;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          main {
            margin-left: 64px;
            padding: 20px;
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          main {
            background-color: rgb(17, 24, 39);
            color: rgb(243, 244, 246);
          }
        }
      `}</style>
    </div>
  );
};

export default SettingsLayout;