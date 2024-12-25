import React, { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { DatePickerComponent } from '../common/DatePicker';
import { Select } from '../common/Select';
import { useAnalytics } from '../../hooks/useAnalytics';
import { WHATSAPP_CONSTANTS } from '../../config/constants';

// Constants for business hours and analytics
const BUSINESS_HOURS = {
  START: 8, // 8 AM
  END: 18, // 6 PM
};

const ANALYTICS_EVENTS = {
  SCHEDULE_CREATED: 'campaign_schedule_created',
  SCHEDULE_UPDATED: 'campaign_schedule_updated',
  VALIDATION_ERROR: 'campaign_schedule_validation_error',
};

// Recurring patterns for campaigns
const RECURRING_PATTERNS = [
  { value: 'daily', label: 'Diariamente' },
  { value: 'weekly', label: 'Semanalmente' },
  { value: 'monthly', label: 'Mensalmente' },
] as const;

// Brazilian timezone options
const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
] as const;

// Campaign schedule interface
export interface CampaignSchedule {
  startTime: Date;
  endTime: Date | null;
  timezone: string;
  recurringPattern: string | null;
}

// Component props interface
export interface CampaignSchedulerProps {
  initialSchedule?: Partial<CampaignSchedule>;
  campaignType: 'one-time' | 'recurring';
  onScheduleChange: (schedule: CampaignSchedule) => void;
  disabled?: boolean;
  locale?: string;
}

// Validation schema with WhatsApp rate limits
const validationSchema = z.object({
  startTime: z.date()
    .refine(date => {
      const hours = date.getHours();
      return hours >= BUSINESS_HOURS.START && hours < BUSINESS_HOURS.END;
    }, 'Horário deve estar entre 8h e 18h'),
  endTime: z.date().nullable()
    .refine(date => {
      if (!date) return true;
      const hours = date.getHours();
      return hours >= BUSINESS_HOURS.START && hours < BUSINESS_HOURS.END;
    }, 'Horário deve estar entre 8h e 18h'),
  timezone: z.string()
    .refine(tz => TIMEZONE_OPTIONS.map(opt => opt.value).includes(tz as any)),
  recurringPattern: z.string().nullable()
    .refine(pattern => !pattern || RECURRING_PATTERNS.map(p => p.value).includes(pattern as any)),
}).refine(data => {
  if (!data.endTime) return true;
  return data.startTime < data.endTime;
}, {
  message: 'Data final deve ser posterior à data inicial',
  path: ['endTime'],
});

export const CampaignScheduler = React.memo<CampaignSchedulerProps>(({
  initialSchedule,
  campaignType,
  onScheduleChange,
  disabled = false,
  locale = 'pt-BR',
}) => {
  const { trackEvent } = useAnalytics();

  // Form initialization with validation
  const {
    control,
    watch,
    setValue,
    formState: { errors },
    handleSubmit,
  } = useForm<CampaignSchedule>({
    defaultValues: {
      startTime: initialSchedule?.startTime || new Date(),
      endTime: initialSchedule?.endTime || null,
      timezone: initialSchedule?.timezone || 'America/Sao_Paulo',
      recurringPattern: initialSchedule?.recurringPattern || null,
    },
    resolver: async (data) => {
      try {
        const validated = validationSchema.parse(data);
        return { values: validated, errors: {} };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formattedErrors = {};
          error.errors.forEach(err => {
            formattedErrors[err.path[0]] = { message: err.message };
          });
          return { values: {}, errors: formattedErrors };
        }
        return { values: {}, errors: { root: { message: 'Validation failed' } } };
      }
    },
  });

  // Watch form values for changes
  const formValues = watch();

  // Handle form changes
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (!name) return;

      try {
        const validated = validationSchema.parse(value);
        onScheduleChange(validated);
        trackEvent(ANALYTICS_EVENTS.SCHEDULE_UPDATED, {
          campaignType,
          field: name,
          value: value[name],
        });
      } catch (error) {
        trackEvent(ANALYTICS_EVENTS.VALIDATION_ERROR, {
          campaignType,
          field: name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onScheduleChange, campaignType, trackEvent]);

  // Memoized timezone options with ARIA labels
  const timezoneOptions = useMemo(() => 
    TIMEZONE_OPTIONS.map(tz => ({
      ...tz,
      'aria-label': `Fuso horário: ${tz.label}`,
    })), []
  );

  // Memoized recurring pattern options with ARIA labels
  const patternOptions = useMemo(() => 
    RECURRING_PATTERNS.map(pattern => ({
      ...pattern,
      'aria-label': `Padrão de recorrência: ${pattern.label}`,
    })), []
  );

  return (
    <div 
      className="campaign-scheduler space-y-4"
      role="group"
      aria-labelledby="schedule-title"
    >
      <h3 id="schedule-title" className="text-lg font-medium">
        Agendamento da Campanha
      </h3>

      <div className="space-y-4">
        <DatePickerComponent
          value={formValues.startTime}
          onChange={(date) => setValue('startTime', date)}
          label="Data e hora de início"
          disabled={disabled}
          minDate={new Date()}
          locale={locale}
          aria-label="Selecione a data e hora de início"
          aria-invalid={!!errors.startTime}
          aria-describedby={errors.startTime ? 'startTime-error' : undefined}
          errorMessage={errors.startTime?.message}
        />

        {campaignType === 'recurring' && (
          <Select
            name="recurringPattern"
            label="Padrão de recorrência"
            options={patternOptions}
            value={formValues.recurringPattern || ''}
            onChange={(value) => setValue('recurringPattern', value)}
            disabled={disabled}
            error={errors.recurringPattern?.message}
            aria-label="Selecione o padrão de recorrência"
            required
          />
        )}

        <DatePickerComponent
          value={formValues.endTime}
          onChange={(date) => setValue('endTime', date)}
          label="Data e hora de término"
          disabled={disabled}
          minDate={formValues.startTime}
          locale={locale}
          aria-label="Selecione a data e hora de término"
          aria-invalid={!!errors.endTime}
          aria-describedby={errors.endTime ? 'endTime-error' : undefined}
          errorMessage={errors.endTime?.message}
        />

        <Select
          name="timezone"
          label="Fuso horário"
          options={timezoneOptions}
          value={formValues.timezone}
          onChange={(value) => setValue('timezone', value)}
          disabled={disabled}
          error={errors.timezone?.message}
          aria-label="Selecione o fuso horário"
          required
        />

        <div className="text-sm text-gray-500" role="note">
          <p>Limite de mensagens: {WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE} por minuto</p>
          <p>Horário de funcionamento: {BUSINESS_HOURS.START}h às {BUSINESS_HOURS.END}h</p>
        </div>
      </div>
    </div>
  );
});

CampaignScheduler.displayName = 'CampaignScheduler';

export default CampaignScheduler;