import React, { useCallback, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import cn from 'classnames';
import { Avatar } from '../common/Avatar';
import { Dropdown } from '../common/Dropdown';
import { useAuth } from '../../hooks/useAuth';
import { theme } from '../../config/theme';
import { UserRole } from '../../types/common';

// Profile menu items with role-based access control
const PROFILE_MENU_ITEMS = [
  {
    label: 'Profile Settings',
    value: 'profile',
    icon: <UserIcon className="w-4 h-4" />,
    ariaLabel: 'Go to profile settings',
    requiredRole: 'user'
  },
  {
    label: 'Organization Settings',
    value: 'organization',
    icon: <BuildingIcon className="w-4 h-4" />,
    ariaLabel: 'Go to organization settings',
    requiredRole: UserRole.ADMIN
  },
  {
    label: 'Logout',
    value: 'logout',
    icon: <LogoutIcon className="w-4 h-4" />,
    ariaLabel: 'Logout from application',
    requiredRole: 'user'
  }
] as const;

// Responsive breakpoints matching design system
const BREAKPOINTS = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px'
} as const;

// Header component props interface
interface HeaderProps {
  className?: string;
  ariaLabel?: string;
}

// SVG Icons components
const UserIcon = memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
));

const BuildingIcon = memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M3 7v14M21 7v14M3 7l9-4 9 4M12 7v14" />
  </svg>
));

const LogoutIcon = memo(() => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
));

/**
 * Header component implementing a secure and accessible navigation bar
 * with authentication state management and responsive design
 */
export const Header: React.FC<HeaderProps> = memo(({ 
  className,
  ariaLabel = 'Main navigation'
}) => {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  // Handle profile menu actions with role validation
  const handleProfileAction = useCallback(async (value: string) => {
    try {
      switch (value) {
        case 'profile':
          await router.push('/settings/profile');
          break;
        case 'organization':
          if (user?.role === UserRole.ADMIN) {
            await router.push('/settings/organization');
          }
          break;
        case 'logout':
          await logout();
          break;
        default:
          console.warn('Unknown profile action:', value);
      }
    } catch (error) {
      console.error('Profile action error:', error);
    }
  }, [router, user, logout]);

  // Filter menu items based on user role
  const filteredMenuItems = PROFILE_MENU_ITEMS.filter(item => 
    item.requiredRole === 'user' || user?.role === item.requiredRole
  );

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'h-16 px-4 md:px-6',
        'bg-white dark:bg-gray-900',
        'border-b border-gray-200 dark:border-gray-800',
        'flex items-center justify-between',
        'transition-colors duration-200',
        className
      )}
      role="banner"
      aria-label={ariaLabel}
    >
      {/* Logo and Brand */}
      <Link 
        href="/"
        className="flex items-center gap-2"
        aria-label="Go to homepage"
      >
        <Image
          src="/logo.svg"
          alt="Porfin Logo"
          width={32}
          height={32}
          priority
        />
        <span className="hidden md:block text-lg font-semibold">
          Porfin
        </span>
      </Link>

      {/* Main Navigation */}
      <nav
        className="hidden md:flex items-center gap-6"
        role="navigation"
        aria-label="Main navigation"
      >
        <Link
          href="/dashboard"
          className={cn(
            'nav-link',
            router.pathname === '/dashboard' && 'text-primary-600'
          )}
          aria-current={router.pathname === '/dashboard' ? 'page' : undefined}
        >
          Dashboard
        </Link>
        <Link
          href="/chats"
          className={cn(
            'nav-link',
            router.pathname === '/chats' && 'text-primary-600'
          )}
          aria-current={router.pathname === '/chats' ? 'page' : undefined}
        >
          Chats
        </Link>
        <Link
          href="/assistants"
          className={cn(
            'nav-link',
            router.pathname === '/assistants' && 'text-primary-600'
          )}
          aria-current={router.pathname === '/assistants' ? 'page' : undefined}
        >
          Assistants
        </Link>
        <Link
          href="/campaigns"
          className={cn(
            'nav-link',
            router.pathname === '/campaigns' && 'text-primary-600'
          )}
          aria-current={router.pathname === '/campaigns' ? 'page' : undefined}
        >
          Campaigns
        </Link>
      </nav>

      {/* User Profile Section */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          // Loading skeleton
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="w-20 h-4 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : user ? (
          <Dropdown
            trigger={
              <button
                className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Open user menu"
              >
                <Avatar
                  size="sm"
                  src={user.avatar}
                  name={user.name}
                  alt={`${user.name}'s profile picture`}
                />
                <span className="hidden md:block text-sm font-medium">
                  {user.name}
                </span>
              </button>
            }
            items={filteredMenuItems}
            label="User menu"
            onSelect={handleProfileAction}
            placement="bottom"
            className="w-48"
          />
        ) : (
          <Link
            href="/login"
            className={cn(
              'button-primary',
              'px-4 py-2 rounded-md',
              'text-sm font-medium'
            )}
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
});

Header.displayName = 'Header';

// Default export
export default Header;

// CSS styles for navigation links
const styles = `
  .nav-link {
    @apply text-sm font-medium text-gray-700 dark:text-gray-300;
    @apply hover:text-primary-600 dark:hover:text-primary-400;
    @apply transition-colors duration-200;
  }

  .button-primary {
    @apply bg-primary-600 text-white;
    @apply hover:bg-primary-700;
    @apply focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2;
    @apply dark:focus:ring-offset-gray-900;
    @apply transition-colors duration-200;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}