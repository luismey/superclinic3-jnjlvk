'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx'; // v2.0.0
import Header from '../../../components/layout/Header';
import Sidebar from '../../../components/layout/Sidebar';
import { useAuth } from '../../../hooks/useAuth';
import { theme } from '../../../config/theme';
import { ROUTES } from '../../../config/routes';

// Interface for layout props
interface AssistantLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

/**
 * Layout component for individual assistant pages implementing role-based access,
 * responsive design, and accessibility features
 */
const AssistantLayout = React.memo(({ children, params }: AssistantLayoutProps) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Validate user access and permissions
  useEffect(() => {
    if (!isLoading) {
      // Check authentication
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      // Check role-based access
      const assistantRoute = ROUTES.PROTECTED_ROUTES.find(route => 
        route.path.startsWith('/assistants')
      );

      if (!assistantRoute?.roles.includes(user?.role || '')) {
        router.push('/dashboard');
        return;
      }
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Handle component mounting for hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle sidebar state
  const handleSidebarToggle = (expanded: boolean) => {
    setSidebarExpanded(expanded);
  };

  // Don't render until mounted to prevent hydration issues
  if (!isMounted) {
    return null;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <Header 
        className={clsx(
          'fixed top-0 right-0 left-0',
          'z-30 transition-all duration-200',
          sidebarExpanded ? 'lg:pl-60' : 'lg:pl-16'
        )}
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main
        className={clsx(
          'pt-16 min-h-screen transition-all duration-200',
          sidebarExpanded ? 'lg:pl-60' : 'lg:pl-16',
          'px-4 md:px-6 lg:px-8'
        )}
        style={{
          backgroundColor: theme.colors.semantic.background,
        }}
      >
        {/* Assistant Content Container */}
        <div
          className={clsx(
            'max-w-7xl mx-auto py-6',
            'rounded-lg bg-white dark:bg-gray-800',
            'shadow-sm border border-gray-200 dark:border-gray-700'
          )}
          role="main"
          aria-label={`Assistant ${params.id} content`}
        >
          {/* Breadcrumb Navigation */}
          <nav
            className="px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-700"
            aria-label="Breadcrumb"
          >
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <a 
                  href="/assistants"
                  className="text-gray-500 hover:text-primary-600 dark:text-gray-400"
                >
                  Assistants
                </a>
              </li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-900 dark:text-white font-medium">
                {params.id}
              </li>
            </ol>
          </nav>

          {/* Content Area */}
          <div className="p-4 md:p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
});

AssistantLayout.displayName = 'AssistantLayout';

export default AssistantLayout;