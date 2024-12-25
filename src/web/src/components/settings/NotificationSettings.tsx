import React, { useCallback, useEffect, useState } from 'react';
import * as Switch from '@radix-ui/react-switch'; // v1.0.0
import debounce from 'lodash/debounce'; // v4.0.8
import { Card } from '../common/Card';
import { useNotification } from '../../hooks/useNotification';
import { useOrganizationStore } from '../../store/organization';
import { theme } from '../../config/theme';

// Interface for notification preferences
interface NotificationPreferences {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  webEnabled: boolean;
  dailyDigest: boolean;
  instantAlerts: boolean;
  customPreferences: Record<string, boolean>;
}

/**
 * Component for managing organization-wide notification settings
 * Implements accessibility standards and provides real-time feedback
 */
export const NotificationSettings: React.FC = () => {
  // Global state and hooks
  const { organization, updateSettings } = useOrganizationStore();
  const { showSuccess, showError } = useNotification();
  
  // Local state for notification preferences
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailEnabled: false,
    whatsappEnabled: false,
    webEnabled: false,
    dailyDigest: false,
    instantAlerts: true,
    customPreferences: {},
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Initialize preferences from organization settings
  useEffect(() => {
    if (organization?.settings?.notifications) {
      setPreferences(organization.settings.notifications);
    }
  }, [organization]);

  // Debounced save function to prevent excessive API calls
  const debouncedSave = useCallback(
    debounce(async (newPreferences: NotificationPreferences) => {
      try {
        await updateSettings({
          notifications: newPreferences,
        });
        showSuccess({
          message: 'Notification preferences updated successfully',
          duration: 3000,
        });
      } catch (error) {
        showError({
          message: 'Failed to update notification preferences',
          duration: 5000,
        });
        // Revert to previous state on error
        if (organization?.settings?.notifications) {
          setPreferences(organization.settings.notifications);
        }
      }
    }, 500),
    [updateSettings, showSuccess, showError, organization]
  );

  // Handle toggle changes with optimistic updates
  const handleToggleChange = useCallback(
    async (key: keyof NotificationPreferences | string, value: boolean) => {
      setIsLoading(true);
      
      // Optimistically update UI
      setPreferences(prev => {
        if (key in prev) {
          return { ...prev, [key]: value };
        }
        return {
          ...prev,
          customPreferences: {
            ...prev.customPreferences,
            [key]: value,
          },
        };
      });

      // Save changes
      const newPreferences = {
        ...preferences,
        [key]: value,
      };
      
      await debouncedSave(newPreferences);
      setIsLoading(false);
    },
    [preferences, debouncedSave]
  );

  return (
    <Card
      className="space-y-6 p-6"
      aria-label="Notification Settings"
      role="region"
    >
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-semantic-text-primary">
          Notification Preferences
        </h2>
        
        <p className="text-semantic-text-secondary">
          Configure how and when you want to receive notifications
        </p>
      </div>

      <div className="space-y-6">
        {/* Notification Channels */}
        <section className="space-y-4" aria-labelledby="channels-heading">
          <h3 
            id="channels-heading" 
            className="text-lg font-medium text-semantic-text-primary"
          >
            Notification Channels
          </h3>

          <div className="space-y-4">
            {/* Email Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label 
                  htmlFor="email-toggle"
                  className="text-sm font-medium text-semantic-text-primary"
                >
                  Email Notifications
                </label>
                <p className="text-sm text-semantic-text-secondary">
                  Receive notifications via email
                </p>
              </div>
              <Switch.Root
                id="email-toggle"
                checked={preferences.emailEnabled}
                onCheckedChange={(checked) => handleToggleChange('emailEnabled', checked)}
                disabled={isLoading}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${preferences.emailEnabled ? 'bg-primary-600' : 'bg-semantic-text-disabled'}
                  disabled:opacity-50 transition-colors
                `}
              >
                <Switch.Thumb 
                  className={`
                    block h-5 w-5 rounded-full bg-white
                    transform transition-transform
                    ${preferences.emailEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </Switch.Root>
            </div>

            {/* WhatsApp Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label 
                  htmlFor="whatsapp-toggle"
                  className="text-sm font-medium text-semantic-text-primary"
                >
                  WhatsApp Notifications
                </label>
                <p className="text-sm text-semantic-text-secondary">
                  Receive notifications via WhatsApp
                </p>
              </div>
              <Switch.Root
                id="whatsapp-toggle"
                checked={preferences.whatsappEnabled}
                onCheckedChange={(checked) => handleToggleChange('whatsappEnabled', checked)}
                disabled={isLoading}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${preferences.whatsappEnabled ? 'bg-primary-600' : 'bg-semantic-text-disabled'}
                  disabled:opacity-50 transition-colors
                `}
              >
                <Switch.Thumb 
                  className={`
                    block h-5 w-5 rounded-full bg-white
                    transform transition-transform
                    ${preferences.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </Switch.Root>
            </div>

            {/* Web Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label 
                  htmlFor="web-toggle"
                  className="text-sm font-medium text-semantic-text-primary"
                >
                  Web Notifications
                </label>
                <p className="text-sm text-semantic-text-secondary">
                  Receive notifications in the browser
                </p>
              </div>
              <Switch.Root
                id="web-toggle"
                checked={preferences.webEnabled}
                onCheckedChange={(checked) => handleToggleChange('webEnabled', checked)}
                disabled={isLoading}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${preferences.webEnabled ? 'bg-primary-600' : 'bg-semantic-text-disabled'}
                  disabled:opacity-50 transition-colors
                `}
              >
                <Switch.Thumb 
                  className={`
                    block h-5 w-5 rounded-full bg-white
                    transform transition-transform
                    ${preferences.webEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </Switch.Root>
            </div>
          </div>
        </section>

        {/* Notification Frequency */}
        <section className="space-y-4" aria-labelledby="frequency-heading">
          <h3 
            id="frequency-heading"
            className="text-lg font-medium text-semantic-text-primary"
          >
            Notification Frequency
          </h3>

          <div className="space-y-4">
            {/* Daily Digest */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label 
                  htmlFor="digest-toggle"
                  className="text-sm font-medium text-semantic-text-primary"
                >
                  Daily Digest
                </label>
                <p className="text-sm text-semantic-text-secondary">
                  Receive a daily summary of all notifications
                </p>
              </div>
              <Switch.Root
                id="digest-toggle"
                checked={preferences.dailyDigest}
                onCheckedChange={(checked) => handleToggleChange('dailyDigest', checked)}
                disabled={isLoading}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${preferences.dailyDigest ? 'bg-primary-600' : 'bg-semantic-text-disabled'}
                  disabled:opacity-50 transition-colors
                `}
              >
                <Switch.Thumb 
                  className={`
                    block h-5 w-5 rounded-full bg-white
                    transform transition-transform
                    ${preferences.dailyDigest ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </Switch.Root>
            </div>

            {/* Instant Alerts */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label 
                  htmlFor="instant-toggle"
                  className="text-sm font-medium text-semantic-text-primary"
                >
                  Instant Alerts
                </label>
                <p className="text-sm text-semantic-text-secondary">
                  Receive notifications in real-time
                </p>
              </div>
              <Switch.Root
                id="instant-toggle"
                checked={preferences.instantAlerts}
                onCheckedChange={(checked) => handleToggleChange('instantAlerts', checked)}
                disabled={isLoading}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full
                  ${preferences.instantAlerts ? 'bg-primary-600' : 'bg-semantic-text-disabled'}
                  disabled:opacity-50 transition-colors
                `}
              >
                <Switch.Thumb 
                  className={`
                    block h-5 w-5 rounded-full bg-white
                    transform transition-transform
                    ${preferences.instantAlerts ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </Switch.Root>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
};

export default NotificationSettings;