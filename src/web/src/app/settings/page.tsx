'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import Card from '../../components/common/Card';
import Tabs from '../../components/common/Tabs';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import { UserRole } from '../../types/common';
import { useRouter, useSearchParams } from 'next/navigation'; // v14.0.0

// Settings tab configuration with role-based access and audit levels
interface SettingsTab {
  id: string;
  label: string;
  component: React.FC;
  requiredRoles: UserRole[];
  analyticsId: string;
  auditLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Settings tabs configuration with proper access control
const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'profile',
    label: 'Profile',
    component: React.lazy(() => import('./sections/ProfileSettings')),
    requiredRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR, UserRole.AGENT],
    analyticsId: 'settings_profile',
    auditLevel: 'low'
  },
  {
    id: 'organization',
    label: 'Organization',
    component: React.lazy(() => import('./sections/OrganizationSettings')),
    requiredRoles: [UserRole.ADMIN, UserRole.MANAGER],
    analyticsId: 'settings_org',
    auditLevel: 'high'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    component: React.lazy(() => import('./sections/WhatsAppSettings')),
    requiredRoles: [UserRole.ADMIN, UserRole.MANAGER],
    analyticsId: 'settings_whatsapp',
    auditLevel: 'high'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    component: React.lazy(() => import('./sections/NotificationSettings')),
    requiredRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR],
    analyticsId: 'settings_notifications',
    auditLevel: 'medium'
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    component: React.lazy(() => import('./sections/ApiKeySettings')),
    requiredRoles: [UserRole.ADMIN, UserRole.MANAGER],
    analyticsId: 'settings_api',
    auditLevel: 'critical'
  }
];

/**
 * Settings page component providing comprehensive settings management
 * with role-based access control and audit logging
 */
const SettingsPage: React.FC = () => {
  // Hooks initialization
  const { user, isLoading: authLoading } = useAuth();
  const { organization, loading: orgLoading, error: orgError } = useOrganization();
  const { showBoundary } = useErrorBoundary();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Local state
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize active tab from URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && SETTINGS_TABS.some(tab => tab.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Handle loading states
  useEffect(() => {
    setIsLoading(authLoading || orgLoading);
  }, [authLoading, orgLoading]);

  // Handle organization error
  useEffect(() => {
    if (orgError) {
      showBoundary(orgError);
    }
  }, [orgError, showBoundary]);

  /**
   * Validates user access to a settings tab
   */
  const canAccessTab = useCallback((tab: SettingsTab): boolean => {
    if (!user) return false;
    return tab.requiredRoles.includes(user.role);
  }, [user]);

  /**
   * Handles tab change with validation and analytics
   */
  const handleTabChange = useCallback((tabId: string) => {
    const tab = SETTINGS_TABS.find(t => t.id === tabId);
    if (!tab) return;

    // Validate access
    if (!canAccessTab(tab)) {
      console.error('Access denied to settings tab:', tabId);
      return;
    }

    // Update URL
    router.push(`/settings?tab=${tabId}`, { scroll: false });

    // Track analytics
    if (window.analytics) {
      window.analytics.track('settings_tab_change', {
        tabId,
        analyticsId: tab.analyticsId,
        auditLevel: tab.auditLevel
      });
    }

    setActiveTab(tabId);
  }, [canAccessTab, router]);

  // Render loading state
  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </Card>
    );
  }

  // Filter accessible tabs based on user role
  const accessibleTabs = SETTINGS_TABS.filter(canAccessTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Card 
        className="mb-6"
        role="region"
        aria-label="Settings"
      >
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Settings
        </h1>

        <Tabs
          selectedIndex={accessibleTabs.findIndex(tab => tab.id === activeTab)}
          onChange={(index) => handleTabChange(accessibleTabs[index].id)}
        >
          <Tabs.TabList aria-label="Settings sections">
            {accessibleTabs.map(tab => (
              <Tabs.Tab
                key={tab.id}
                className="px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-controls={`panel-${tab.id}`}
              >
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.TabList>

          {accessibleTabs.map(tab => (
            <Tabs.TabPanel
              key={tab.id}
              id={`panel-${tab.id}`}
              className="py-6"
            >
              <React.Suspense
                fallback={
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                }
              >
                <tab.component />
              </React.Suspense>
            </Tabs.TabPanel>
          ))}
        </Tabs>
      </Card>
    </div>
  );
};

export default SettingsPage;