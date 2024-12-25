import React, { memo, useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0
import { z } from 'zod'; // v3.0.0
import { Button } from '../common/Button';
import { Campaign, CampaignType, CampaignStatus } from '../../types/campaign';
import useCampaign from '../../hooks/useCampaign';
import { WHATSAPP_CONSTANTS } from '../../config/constants';

// Form validation schema
const campaignFormSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  type: z.nativeEnum(CampaignType),
  messageTemplate: z.object({
    content: z.string().min(1, 'Message content is required'),
    variables: z.array(z.string())
  }),
  targetFilters: z.object({
    segments: z.array(z.string()),
    customFilters: z.record(z.string())
  }),
  scheduleConfig: z.object({
    startDate: z.date().min(new Date(), 'Start date must be in the future'),
    endDate: z.date().optional(),
    timezone: z.string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/),
    dailyStartHour: z.number().min(0).max(23),
    dailyEndHour: z.number().min(0).max(23),
    activeDays: z.array(z.number().min(0).max(6))
  }).refine(data => !data.endDate || data.startDate < data.endDate, {
    message: "End date must be after start date"
  }),
  rateLimit: z.number()
    .min(1, 'Rate limit must be at least 1')
    .max(parseInt(WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE), 
      `Rate limit cannot exceed ${WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE} messages per minute`)
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

interface CampaignFormProps {
  initialData?: Campaign;
  onSubmit: (data: Campaign) => void;
  onCancel: () => void;
}

export const CampaignForm = memo(({ 
  initialData, 
  onSubmit, 
  onCancel 
}: CampaignFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createCampaign, updateCampaign, error } = useCampaign();

  // Initialize form with react-hook-form and zod validation
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: initialData || {
      name: '',
      type: CampaignType.SCHEDULED,
      messageTemplate: {
        content: '',
        variables: []
      },
      targetFilters: {
        segments: [],
        customFilters: {}
      },
      scheduleConfig: {
        startDate: new Date(),
        timezone: 'America/Sao_Paulo',
        dailyStartHour: 9,
        dailyEndHour: 18,
        activeDays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      rateLimit: 30 // Default to 30 messages per minute
    }
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Handle form submission with validation and error handling
  const onFormSubmit = useCallback(async (data: CampaignFormData) => {
    try {
      setIsSubmitting(true);

      const campaignData = {
        ...data,
        status: CampaignStatus.SCHEDULED,
        analytics: {
          totalRecipients: 0,
          messagesSent: 0,
          messagesDelivered: 0,
          messagesFailed: 0,
          messagesPending: 0,
          deliveryRate: 0,
          failureRate: 0,
          averageDeliveryTime: 0
        }
      };

      const result = initialData
        ? await updateCampaign(initialData.id, campaignData)
        : await createCampaign(campaignData);

      onSubmit(result);
    } catch (err) {
      console.error('Campaign submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [initialData, createCampaign, updateCampaign, onSubmit]);

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-6"
      aria-label="Campaign form"
    >
      {/* Campaign Name */}
      <div className="space-y-2">
        <label 
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Campaign Name
        </label>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              id="name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
          )}
        />
        {errors.name && (
          <p id="name-error" className="text-sm text-error-600">
            {errors.name.message}
          </p>
        )}
      </div>

      {/* Campaign Type */}
      <div className="space-y-2">
        <label 
          htmlFor="type"
          className="block text-sm font-medium text-gray-700"
        >
          Campaign Type
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              id="type"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              aria-invalid={!!errors.type}
              aria-describedby={errors.type ? "type-error" : undefined}
            >
              {Object.values(CampaignType).map(type => (
                <option key={type} value={type}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          )}
        />
        {errors.type && (
          <p id="type-error" className="text-sm text-error-600">
            {errors.type.message}
          </p>
        )}
      </div>

      {/* Message Template */}
      <div className="space-y-2">
        <label 
          htmlFor="messageTemplate.content"
          className="block text-sm font-medium text-gray-700"
        >
          Message Content
        </label>
        <Controller
          name="messageTemplate.content"
          control={control}
          render={({ field }) => (
            <textarea
              {...field}
              id="messageTemplate.content"
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              aria-invalid={!!errors.messageTemplate?.content}
              aria-describedby={errors.messageTemplate?.content ? "content-error" : undefined}
            />
          )}
        />
        {errors.messageTemplate?.content && (
          <p id="content-error" className="text-sm text-error-600">
            {errors.messageTemplate.content.message}
          </p>
        )}
      </div>

      {/* Rate Limit */}
      <div className="space-y-2">
        <label 
          htmlFor="rateLimit"
          className="block text-sm font-medium text-gray-700"
        >
          Rate Limit (messages per minute)
        </label>
        <Controller
          name="rateLimit"
          control={control}
          render={({ field: { value, onChange, ...field } }) => (
            <input
              {...field}
              type="number"
              value={value}
              onChange={e => onChange(parseInt(e.target.value))}
              min={1}
              max={parseInt(WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              aria-invalid={!!errors.rateLimit}
              aria-describedby={errors.rateLimit ? "rate-error" : undefined}
            />
          )}
        />
        {errors.rateLimit && (
          <p id="rate-error" className="text-sm text-error-600">
            {errors.rateLimit.message}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={!isDirty || isSubmitting}
        >
          {initialData ? 'Update Campaign' : 'Create Campaign'}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div 
          role="alert"
          className="p-4 rounded-md bg-error-50 text-error-700 border border-error-200"
        >
          {error}
        </div>
      )}
    </form>
  );
});

CampaignForm.displayName = 'CampaignForm';

export default CampaignForm;