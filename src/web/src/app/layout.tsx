'use client';

import React, { useEffect, useState } from 'react';
import { Metadata } from 'next';
import clsx from 'clsx';
import { Header } from '../components/layout/Header';
import { Navigation } from '../components/layout/Navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../hooks/useAuth';
import { UI_CONSTANTS } from '../config/constants';

// Define metadata for SEO and document head
export const metadata: Metadata = {
  title: 'Porfin - WhatsApp Automation Platform',
  description: 'AI-powered WhatsApp automation platform for businesses',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://porfin.com.br',
    title: 'Porfin - WhatsApp Automation Platform',
    description: 'AI-powered WhatsApp automation platform for businesses',
    siteName: 'Porfin',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Props interface for the root layout
interface RootLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Root layout component implementing the application's base structure
 * Provides authentication context, responsive layout, and accessibility features
 */
export default function RootLayout({ children, className }: RootLayoutProps) {
  // Authentication state management
  const { isAuthenticated, isLoading, user } = useAuth();
  
  // Responsive state management
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Theme management
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Handle responsive layout changes
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < parseInt(UI_CONSTANTS.BREAKPOINTS.TABLET);
      setIsSidebarCollapsed(isMobile);
      if (isMobile) {
        setIsMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle theme changes and system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleThemeChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Handle mobile menu toggle
  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  return (
    <html 
      lang="pt-BR" 
      className={clsx(isDarkMode && 'dark')}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content={isDarkMode ? '#1e293b' : '#ffffff'} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body 
        className={clsx(
          'font-inter antialiased',
          'bg-white dark:bg-gray-900',
          'text-gray-900 dark:text-gray-100',
          className
        )}
      >
        {/* Skip to main content link for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:p-4"
        >
          Pular para o conteúdo principal
        </a>

        {/* Main layout structure */}
        <div className="min-h-screen flex flex-col">
          <Header 
            onMenuToggle={handleMobileMenuToggle}
            className="z-30"
          />

          <div className="flex-1 flex">
            {isAuthenticated && (
              <Sidebar 
                isCollapsed={isSidebarCollapsed}
                onToggle={handleSidebarToggle}
                className="z-20"
              />
            )}

            <main 
              id="main-content"
              className={clsx(
                'flex-1',
                'transition-all duration-300',
                isAuthenticated && !isSidebarCollapsed && 'ml-64',
                isAuthenticated && isSidebarCollapsed && 'ml-16'
              )}
            >
              {/* Mobile navigation overlay */}
              {isMobileMenuOpen && (
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 z-10"
                  onClick={handleMobileMenuToggle}
                  aria-hidden="true"
                />
              )}

              {/* Mobile navigation */}
              <Navigation 
                className={clsx(
                  'lg:hidden',
                  'fixed inset-y-0 left-0 w-64',
                  'transform transition-transform duration-300',
                  isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                )}
              />

              {/* Page content */}
              <div className="px-4 py-6 sm:px-6 lg:px-8">
                {isLoading ? (
                  <div className="flex items-center justify-center min-h-screen">
                    {/* Add loading spinner component here */}
                  </div>
                ) : (
                  children
                )}
              </div>
            </main>
          </div>

          <Footer className="z-10" />
        </div>
      </body>
    </html>
  );
}