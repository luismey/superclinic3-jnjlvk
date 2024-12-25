'use client';

import React, { useLayoutEffect, useState } from 'react';
import classNames from 'classnames'; // v2.3.0
import Navigation from '../../../components/layout/Navigation';
import Header from '../../../components/layout/Header';
import Sidebar from '../../../components/layout/Sidebar';
import { useAuth } from '../../../hooks/useAuth';
import { UI_CONSTANTS } from '../../../config/constants';

// Types for layout props
interface CampaignsLayoutProps {
  children: React.ReactNode;
  className?: string;
  role?: string;
  'aria-label'?: string;
}

/**
 * Layout component for the campaigns section implementing consistent structure
 * with role-based access control and responsive design
 */
const CampaignsLayout: React.FC<CampaignsLayoutProps> = ({
  children,
  className,
  role = 'main',
  'aria-label': ariaLabel = 'Campaigns section',
}) => {
  // Authentication and authorization state
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle authorization and responsive behavior
  useLayoutEffect(() => {
    // Check user authorization for campaigns section
    const checkAuthorization = () => {
      if (!isAuthenticated || !user) {
        setIsAuthorized(false);
        return;
      }

      // Only admin and manager roles can access campaigns
      const allowedRoles = ['admin', 'manager'];
      setIsAuthorized(allowedRoles.includes(user.role.toLowerCase()));
    };

    // Handle responsive breakpoints
    const handleResize = () => {
      setIsMobile(window.innerWidth < parseInt(UI_CONSTANTS.BREAKPOINTS.TABLET));
    };

    checkAuthorization();
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isAuthenticated, user]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-48 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Show unauthorized message
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Access Restricted
        </h1>
        <p className="text-gray-600 text-center">
          You don't have permission to access the campaigns section.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header with user profile */}
        <Header className="border-b border-gray-200 dark:border-gray-800" />

        {/* Main content with navigation */}
        <main
          role={role}
          aria-label={ariaLabel}
          className={classNames(
            'flex-1 overflow-y-auto',
            'pt-16', // Account for fixed header height
            'px-4 md:px-6 lg:px-8',
            'transition-all duration-200',
            {
              'ml-16': !isMobile, // Collapsed sidebar width
              'ml-0': isMobile,
            },
            className
          )}
        >
          {/* Campaign section navigation */}
          <Navigation className="mb-6" />

          {/* Page content */}
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CampaignsLayout;