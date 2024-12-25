import { z } from 'zod'; // v3.22.0
import { UI_CONSTANTS } from './constants';

// Type Definitions
export type RouteConfig = {
  path: string;
  roles: string[];
  title: string;
  metadata: {
    description: string;
    requiresAuth: boolean;
    layout?: 'default' | 'chat';
  };
};

// Route Schema Validation
export const RouteSchema = z.object({
  path: z.string().startsWith('/'),
  roles: z.array(z.string()),
  title: z.string(),
  metadata: z.object({
    description: z.string(),
    requiresAuth: z.boolean(),
    layout: z.enum(['default', 'chat']).optional()
  })
});

/**
 * Validates route configuration using Zod schema
 * @param routeConfig - Route configuration object to validate
 * @returns boolean - True if validation passes
 * @throws ZodError if validation fails
 */
export function validateRouteConfig(routeConfig: RouteConfig): boolean {
  try {
    // Validate basic structure
    RouteSchema.parse(routeConfig);

    // Additional validation for protected routes
    if (routeConfig.metadata.requiresAuth && routeConfig.roles.length === 0) {
      throw new Error('Protected routes must have at least one role defined');
    }

    // Validate path format
    if (!routeConfig.path.match(/^\/[a-z0-9\-\/]*$/)) {
      throw new Error('Invalid route path format');
    }

    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Route validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Route Configurations
export const ROUTES = {
  PUBLIC_ROUTES: [
    {
      path: '/',
      roles: ['*'],
      title: 'Porfin - WhatsApp Automation Platform',
      metadata: {
        description: 'AI-powered WhatsApp automation platform for businesses',
        requiresAuth: false
      }
    },
    {
      path: '/login',
      roles: ['*'],
      title: 'Login - Porfin',
      metadata: {
        description: 'Secure login to your Porfin account',
        requiresAuth: false
      }
    },
    {
      path: '/register',
      roles: ['*'],
      title: 'Register - Porfin',
      metadata: {
        description: 'Create your Porfin account',
        requiresAuth: false
      }
    }
  ] as const,

  PROTECTED_ROUTES: [
    {
      path: '/dashboard',
      roles: ['admin', 'manager', 'operator', 'agent'],
      title: 'Dashboard - Porfin',
      metadata: {
        description: 'Your Porfin dashboard overview',
        requiresAuth: true,
        layout: 'default'
      }
    },
    {
      path: '/chats',
      roles: ['admin', 'manager', 'operator', 'agent'],
      title: 'Chats - Porfin',
      metadata: {
        description: 'Manage your WhatsApp conversations',
        requiresAuth: true,
        layout: 'chat'
      }
    },
    {
      path: '/assistants',
      roles: ['admin', 'manager'],
      title: 'Virtual Assistants - Porfin',
      metadata: {
        description: 'Configure your AI assistants',
        requiresAuth: true,
        layout: 'default'
      }
    },
    {
      path: '/campaigns',
      roles: ['admin', 'manager'],
      title: 'Campaigns - Porfin',
      metadata: {
        description: 'Manage your messaging campaigns',
        requiresAuth: true,
        layout: 'default'
      }
    },
    {
      path: '/analytics',
      roles: ['admin', 'manager'],
      title: 'Analytics - Porfin',
      metadata: {
        description: 'View your performance metrics',
        requiresAuth: true,
        layout: 'default'
      }
    },
    {
      path: '/settings',
      roles: ['admin'],
      title: 'Settings - Porfin',
      metadata: {
        description: 'Manage your account settings',
        requiresAuth: true,
        layout: 'default'
      }
    }
  ] as const
} as const;

// Type for all routes
export type Routes = typeof ROUTES;

// Helper types for route paths
export type PublicRoutePath = typeof ROUTES.PUBLIC_ROUTES[number]['path'];
export type ProtectedRoutePath = typeof ROUTES.PROTECTED_ROUTES[number]['path'];
export type RoutePath = PublicRoutePath | ProtectedRoutePath;

// Helper types for roles
export type UserRole = 'admin' | 'manager' | 'operator' | 'agent';

/**
 * Validates all route configurations at runtime
 * @throws Error if any route configuration is invalid
 */
(function validateAllRoutes() {
  try {
    [...ROUTES.PUBLIC_ROUTES, ...ROUTES.PROTECTED_ROUTES].forEach(route => {
      validateRouteConfig(route);
    });
  } catch (error) {
    console.error('Route configuration validation failed:', error);
    throw error;
  }
})();

// Export breakpoints for responsive layouts
export const { BREAKPOINTS } = UI_CONSTANTS;