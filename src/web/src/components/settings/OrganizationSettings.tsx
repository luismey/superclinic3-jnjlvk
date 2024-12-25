import React, { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // ^3.0.0
import debounce from 'lodash/debounce'; // ^4.17.21
import { z } from 'zod'; // ^3.22.0

import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { useOrganization } from '../../hooks/useOrganization';
import { OrganizationPlan, organizationSchema } from '../../types/organization';
import { theme } from '../../config/theme';

// Form validation schema based on organization schema
const formSchema = z.object({
  name: organizationSchema.shape.name,
  plan: organizationSchema.shape.plan,
  settings: z.object({
    features: z.object({
      whatsappEnabled: z.boolean(),
      aiAssistantEnabled: z.boolean(),
      campaignsEnabled: z.boolean(),
      analyticsEnabled: z.boolean(),
      customBranding: z.boolean()
    }),
    limits: z.object({
      maxUsers: z.number().int().positive(),
      maxCampaigns: z.number().int().positive(),
      maxAssistants: z.number().int().positive(),
      maxMessagesPerDay: z.number().int().positive(),
      maxConcurrentChats: z.number().int().positive()
    }),
    timezone: z.string(),
    language: z.string()
  })
});

type FormData = z.infer<typeof formSchema>;

/**
 * Organization Settings component for managing organization configuration
 * Implements comprehensive form validation and real-time updates
 */
const OrganizationSettings: React.FC = React.memo(() => {
  // Get organization data and methods
  const { 
    organization,
    updateOrganization,
    updateSettings,
    loading,
    error 
  } = useOrganization();

  // Initialize form with react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: organization || undefined
  });

  // Reset form when organization data changes
  useEffect(() => {
    if (organization) {
      reset(organization);
    }
  }, [organization, reset]);

  // Debounced update function for optimistic updates
  const debouncedUpdate = useCallback(
    debounce(async (data: Partial<FormData>) => {
      try {
        if (data.settings) {
          await updateSettings(data.settings);
        } else {
          await updateOrganization(data);
        }
      } catch (err) {
        console.error('Failed to update organization:', err);
      }
    }, 500),
    [updateOrganization, updateSettings]
  );

  // Form submission handler
  const onSubmit = async (data: FormData) => {
    try {
      await updateOrganization(data);
    } catch (err) {
      console.error('Failed to save organization settings:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Organization Details Section */}
      <Card
        role="region"
        aria-label="Organization Details"
        className="p-6"
      >
        <h2 className={`text-${theme.typography.sizes['2xl']} font-semibold mb-4`}>
          Organization Details
        </h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="org-name"
            label="Organization Name"
            {...register('name')}
            error={errors.name?.message}
            disabled={loading.update}
            aria-describedby="name-error"
          />

          {/* Plan Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Subscription Plan
            </label>
            <select
              {...register('plan')}
              className="w-full rounded-md border border-gray-300 p-2"
              disabled={loading.update}
            >
              {Object.values(OrganizationPlan).map(plan => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Card>

      {/* Features Configuration */}
      <Card
        role="region"
        aria-label="Feature Settings"
        className="p-6"
      >
        <h2 className={`text-${theme.typography.sizes['2xl']} font-semibold mb-4`}>
          Features
        </h2>

        <div className="space-y-4">
          {Object.keys(formSchema.shape.settings.shape.features.shape).map(feature => (
            <div key={feature} className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {feature.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input
                type="checkbox"
                {...register(`settings.features.${feature}`)}
                disabled={loading.settings}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Resource Limits */}
      <Card
        role="region"
        aria-label="Resource Limits"
        className="p-6"
      >
        <h2 className={`text-${theme.typography.sizes['2xl']} font-semibold mb-4`}>
          Resource Limits
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(formSchema.shape.settings.shape.limits.shape).map(limit => (
            <Input
              key={limit}
              id={`limit-${limit}`}
              label={limit.replace(/([A-Z])/g, ' $1').trim()}
              type="number"
              {...register(`settings.limits.${limit}`, { valueAsNumber: true })}
              error={errors.settings?.limits?.[limit]?.message}
              disabled={loading.settings}
              min={1}
            />
          ))}
        </div>
      </Card>

      {/* Localization Settings */}
      <Card
        role="region"
        aria-label="Localization Settings"
        className="p-6"
      >
        <h2 className={`text-${theme.typography.sizes['2xl']} font-semibold mb-4`}>
          Localization
        </h2>

        <div className="space-y-4">
          <Input
            id="timezone"
            label="Timezone"
            {...register('settings.timezone')}
            error={errors.settings?.timezone?.message}
            disabled={loading.settings}
          />

          <Input
            id="language"
            label="Language"
            {...register('settings.language')}
            error={errors.settings?.language?.message}
            disabled={loading.settings}
          />
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="bg-error-50 text-error-700 p-4 rounded-md"
        >
          {error.message}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!isDirty || loading.update}
          className={`
            px-4 py-2 rounded-md
            bg-primary-600 text-white
            hover:bg-primary-700
            focus:outline-none focus:ring-2 focus:ring-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          onClick={handleSubmit(onSubmit)}
        >
          {loading.update ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
});

OrganizationSettings.displayName = 'OrganizationSettings';

export default OrganizationSettings;