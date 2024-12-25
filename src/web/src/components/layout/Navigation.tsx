import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PROTECTED_ROUTES } from '../../config/routes';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { UI_CONSTANTS } from '../../config/constants';

// Constants for responsive breakpoints
const MOBILE_BREAKPOINT = parseInt(UI_CONSTANTS.BREAKPOINTS.MOBILE);
const TABLET_BREAKPOINT = parseInt(UI_CONSTANTS.BREAKPOINTS.TABLET);
const TRANSITION_DURATION = 300;

interface NavigationProps {
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ className }) => {
  // State management
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : TABLET_BREAKPOINT
  );

  // Hooks
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();

  // Memoized values
  const isMobile = useMemo(() => windowWidth < MOBILE_BREAKPOINT, [windowWidth]);
  const isTablet = useMemo(() => windowWidth < TABLET_BREAKPOINT, [windowWidth]);

  // Check if a route is allowed for the current user
  const isRouteAllowed = useCallback((allowedRoles: string[]) => {
    if (!user || !isAuthenticated) return false;
    if (allowedRoles.includes('*')) return true;
    if (user.role === 'ADMIN') return true;
    return allowedRoles.includes(user.role);
  }, [user, isAuthenticated]);

  // Handle mobile menu toggle with animation
  const toggleMobileMenu = useCallback(() => {
    setIsTransitioning(true);
    setIsMobileMenuOpen(prev => !prev);
    setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION);
  }, []);

  // Handle logout with cleanup
  const handleLogout = useCallback(async () => {
    setIsMobileMenuOpen(false);
    await logout();
  }, [logout]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= TABLET_BREAKPOINT) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Generate navigation items based on user role
  const navigationItems = useMemo(() => {
    return PROTECTED_ROUTES.filter(route => isRouteAllowed(route.roles)).map(route => (
      <Link
        key={route.path}
        href={route.path}
        className={`
          flex items-center px-4 py-2 text-sm font-medium rounded-md
          transition-colors duration-200
          ${pathname === route.path
            ? 'bg-primary-100 text-primary-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
        `}
        aria-current={pathname === route.path ? 'page' : undefined}
      >
        {route.icon && (
          <span className="mr-3 h-5 w-5" aria-hidden="true">
            {route.icon}
          </span>
        )}
        <span>{route.title}</span>
      </Link>
    ));
  }, [pathname, isRouteAllowed]);

  // Render mobile menu button
  const renderMobileMenuButton = () => (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMobileMenu}
      className="lg:hidden"
      aria-expanded={isMobileMenuOpen}
      aria-controls="mobile-navigation"
      aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
    >
      <span className="sr-only">
        {isMobileMenuOpen ? 'Close menu' : 'Open menu'}
      </span>
      {/* Hamburger icon */}
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        {isMobileMenuOpen ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        )}
      </svg>
    </Button>
  );

  // Main navigation container classes
  const containerClasses = `
    ${className}
    bg-white
    ${isTablet ? 'shadow-lg' : 'border-r border-gray-200'}
    transition-all
    duration-${TRANSITION_DURATION}
    ${isTransitioning ? 'overflow-hidden' : ''}
  `;

  // Mobile navigation classes
  const mobileNavClasses = `
    fixed
    inset-0
    z-40
    transform
    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
    transition-transform
    duration-${TRANSITION_DURATION}
    lg:hidden
  `;

  return (
    <>
      {/* Desktop Navigation */}
      <nav
        className={`hidden lg:flex lg:flex-col lg:w-64 ${containerClasses}`}
        aria-label="Main navigation"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {navigationItems}
          </div>
        </div>
        {isAuthenticated && (
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full"
            >
              Logout
            </Button>
          </div>
        )}
      </nav>

      {/* Mobile Navigation */}
      {isTablet && (
        <>
          {renderMobileMenuButton()}
          <div className={mobileNavClasses}>
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            <nav
              className={`relative flex flex-col w-full max-w-xs bg-white h-full ${containerClasses}`}
              id="mobile-navigation"
            >
              <div className="px-4 py-4 flex justify-between items-center border-b border-gray-200">
                <h2 className="text-lg font-medium">Menu</h2>
                {renderMobileMenuButton()}
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-4 space-y-1">
                  {navigationItems}
                </div>
              </div>
              {isAuthenticated && (
                <div className="p-4 border-t border-gray-200">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full"
                  >
                    Logout
                  </Button>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default Navigation;