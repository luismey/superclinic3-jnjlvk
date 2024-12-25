// React and Next.js imports - v18.0.0, v14.0.0
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx'; // v2.0.0
import { useSwipeable } from 'react-swipeable'; // v7.0.0

// Internal imports
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { UI_CONSTANTS } from '../../config/constants';

// Constants for sidebar configuration
const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 64;
const STORAGE_KEY_SIDEBAR_STATE = 'sidebar_expanded';
const RATE_LIMIT_SIDEBAR_TOGGLE = 1000;
const TOUCH_SENSITIVITY = 50;

// Types for sidebar navigation items
interface NavItem {
  path: string;
  icon: string;
  label: string;
  roles: string[];
}

/**
 * Enhanced sidebar component with security, accessibility, and mobile support
 */
const Sidebar: React.FC = React.memo(() => {
  // Hooks and state
  const { user, isAuthenticated, validatePermission } = useAuth();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [lastToggle, setLastToggle] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Navigation items with role-based access control
  const navigationItems = useMemo(() => {
    return ROUTES.PROTECTED_ROUTES.map(route => ({
      path: route.path,
      icon: getIconForRoute(route.path),
      label: route.title,
      roles: route.roles
    }));
  }, []);

  /**
   * Handles sidebar state with secure storage and cross-tab sync
   */
  const handleSidebarState = useCallback((expanded: boolean) => {
    const now = Date.now();
    if (now - lastToggle < RATE_LIMIT_SIDEBAR_TOGGLE) return;

    setIsExpanded(expanded);
    setLastToggle(now);
    localStorage.setItem(STORAGE_KEY_SIDEBAR_STATE, JSON.stringify(expanded));

    // Broadcast state change for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY_SIDEBAR_STATE,
      newValue: JSON.stringify(expanded)
    }));
  }, [lastToggle]);

  /**
   * Touch gesture handlers for mobile support
   */
  const touchHandlers = useSwipeable({
    onSwipedRight: () => !isExpanded && handleSidebarState(true),
    onSwipedLeft: () => isExpanded && handleSidebarState(false),
    trackMouse: true,
    delta: TOUCH_SENSITIVITY
  });

  /**
   * Checks if route is allowed based on user role
   */
  const isRouteAllowed = useCallback((allowedRoles: string[]) => {
    if (!user || !isAuthenticated) return false;
    return allowedRoles.includes('*') || validatePermission(allowedRoles);
  }, [user, isAuthenticated, validatePermission]);

  /**
   * Renders navigation items with enhanced security and accessibility
   */
  const renderNavItems = useCallback(() => {
    return navigationItems
      .filter(item => isRouteAllowed(item.roles))
      .map(item => (
        <Link
          key={item.path}
          href={item.path}
          className={clsx(
            'flex items-center px-4 py-2 my-1 rounded-lg transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            pathname === item.path && 'bg-primary-50 dark:bg-primary-900',
            !isExpanded && 'justify-center'
          )}
          aria-current={pathname === item.path ? 'page' : undefined}
          role="menuitem"
        >
          <span className="material-icons-outlined w-6 h-6" aria-hidden="true">
            {item.icon}
          </span>
          {isExpanded && (
            <span className="ml-3 text-sm font-medium truncate">
              {item.label}
            </span>
          )}
        </Link>
      ));
  }, [navigationItems, isRouteAllowed, pathname, isExpanded]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < parseInt(UI_CONSTANTS.BREAKPOINTS.TABLET);
      setIsMobile(mobile);
      if (mobile && isExpanded) {
        handleSidebarState(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleSidebarState, isExpanded]);

  // Handle storage sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_SIDEBAR_STATE) {
        setIsExpanded(JSON.parse(e.newValue || 'true'));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize sidebar state from storage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_SIDEBAR_STATE);
    if (stored !== null) {
      setIsExpanded(JSON.parse(stored));
    }
  }, []);

  return (
    <aside
      {...touchHandlers}
      className={clsx(
        'fixed left-0 top-0 h-full bg-white dark:bg-gray-900',
        'border-r border-gray-200 dark:border-gray-800',
        'transition-all duration-300 ease-in-out z-30',
        isExpanded ? 'w-60' : 'w-16'
      )}
      style={{
        width: isExpanded ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
      }}
      aria-expanded={isExpanded}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo and toggle button */}
      <div className="flex items-center justify-between h-16 px-4">
        <Link href="/dashboard" className="flex items-center">
          {isExpanded ? (
            <img src="/logo.svg" alt="Porfin" className="h-8" />
          ) : (
            <img src="/logo-icon.svg" alt="Porfin" className="h-8" />
          )}
        </Link>
        <button
          onClick={() => handleSidebarState(!isExpanded)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span className="material-icons-outlined">
            {isExpanded ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>
      </div>

      {/* Navigation menu */}
      <nav className="mt-4 px-2" role="menu">
        {renderNavItems()}
      </nav>

      {/* Mobile backdrop */}
      {isMobile && isExpanded && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => handleSidebarState(false)}
          aria-hidden="true"
        />
      )}
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

/**
 * Helper function to get icon for route
 */
function getIconForRoute(path: string): string {
  const icons: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/chats': 'chat',
    '/assistants': 'smart_toy',
    '/campaigns': 'campaign',
    '/analytics': 'analytics',
    '/settings': 'settings'
  };
  return icons[path] || 'circle';
}

export default Sidebar;