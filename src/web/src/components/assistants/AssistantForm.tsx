import React, { useCallback, useMemo } from 'react';
import { z } from 'zod'; // v3.22.0
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Assistant, AssistantType, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS } from '../../types/assistant';
import { useForm } from '../../hooks/useForm';
import { theme } from '../../config/theme';

// Form validation schema with Brazilian Portuguese messages
const assistantFormSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Nome deve conter apenas letras, números, espaços e hífens'),
  
  type: z.nativeEnum(AssistantType, {
    errorMap: () => ({ message: 'Tipo de assistente inválido' })
  }),
  
  config: z.object({
    promptTemplate: z.string()
      .min(1, 'Modelo de mensagem é obrigatório')
      .max(4096, 'Modelo de mensagem muito longo'),
    
    temperature: z.number()
      .min(0, 'Temperatura deve ser entre 0 e 1')
      .max(1, 'Temperatura deve ser entre 0 e 1')
      .default(DEFAULT_TEMPERATURE),
    
    maxTokens: z.number()
      .min(1, 'Limite de tokens deve ser positivo')
      .max(500, 'Limite máximo de 500 tokens')
      .default(DEFAULT_MAX_TOKENS)
  }),
  
  isActive: z.boolean().default(true)
});

export interface AssistantFormProps {
  initialValues?: Partial<Assistant>;
  onSubmit: (assistant: Assistant) => Promise<void>;
  isLoading?: boolean;
  locale?: string;
  timezone?: string;
}

export const AssistantForm = React.memo<AssistantFormProps>(({
  initialValues = {},
  onSubmit,
  isLoading = false,
  locale = 'pt-BR',
  timezone = 'America/Sao_Paulo'
}) => {
  // Initialize form with enhanced validation and security
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    securityState,
    validationState,
    setValue
  } = useForm(assistantFormSchema);

  // Assistant type options with Portuguese labels
  const assistantTypeOptions = useMemo(() => [
    { value: AssistantType.CUSTOMER_SERVICE, label: 'Atendimento ao Cliente' },
    { value: AssistantType.SALES, label: 'Vendas' },
    { value: AssistantType.APPOINTMENT, label: 'Agendamento' },
    { value: AssistantType.CUSTOM, label: 'Personalizado' }
  ], []);

  // Handle type selection with accessibility
  const handleTypeChange = useCallback((value: string) => {
    setValue('type', value as AssistantType, {
      shouldValidate: true,
      shouldDirty: true
    });
  }, [setValue]);

  // Form submission handler with security checks
  const onSubmitForm = useCallback(async (data: z.infer<typeof assistantFormSchema>) => {
    if (securityState.isRateLimited) {
      return;
    }

    try {
      await onSubmit(data as Assistant);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [onSubmit, securityState.isRateLimited]);

  return (
    <form 
      onSubmit={handleSubmit(onSubmitForm)}
      className="space-y-6"
      noValidate
    >
      {/* Name Input */}
      <div className="form-field">
        <Input
          id="assistant-name"
          {...register('name')}
          type="text"
          required
          placeholder="Nome do assistente"
          error={errors.name?.message}
          disabled={isLoading}
          aria-label="Nome do assistente"
          aria-describedby="name-description"
          className="w-full"
        />
        <div id="name-description" className="sr-only">
          Digite o nome do seu assistente virtual usando apenas letras, números, espaços e hífens
        </div>
      </div>

      {/* Type Selection */}
      <div className="form-field">
        <Select
          name="type"
          label="Tipo do Assistente"
          options={assistantTypeOptions}
          onChange={handleTypeChange}
          error={errors.type?.message}
          disabled={isLoading}
          required
          aria-label="Tipo do assistente"
          aria-describedby="type-description"
        />
        <div id="type-description" className="sr-only">
          Selecione o tipo de assistente que melhor se adequa à sua necessidade
        </div>
      </div>

      {/* Prompt Template */}
      <div className="form-field">
        <textarea
          {...register('config.promptTemplate')}
          id="prompt-template"
          rows={4}
          placeholder="Modelo de mensagem para o WhatsApp"
          className={`w-full px-3 py-2 border rounded-md ${
            errors.config?.promptTemplate ? 'border-error-500' : 'border-semantic-border'
          } ${theme.typography.fontFamily.primary.join(' ')}`}
          aria-label="Modelo de mensagem"
          aria-describedby="template-description"
          disabled={isLoading}
        />
        {errors.config?.promptTemplate && (
          <p className="text-error-500 text-sm mt-1" role="alert">
            {errors.config.promptTemplate.message}
          </p>
        )}
        <div id="template-description" className="sr-only">
          Digite o modelo de mensagem que seu assistente usará no WhatsApp
        </div>
      </div>

      {/* Temperature Control */}
      <div className="form-field">
        <Input
          id="temperature"
          {...register('config.temperature', { valueAsNumber: true })}
          type="number"
          step="0.1"
          min="0"
          max="1"
          placeholder="Temperatura (0-1)"
          error={errors.config?.temperature?.message}
          disabled={isLoading}
          aria-label="Temperatura"
          aria-describedby="temperature-description"
        />
        <div id="temperature-description" className="sr-only">
          Defina a criatividade do assistente, de 0 (mais conservador) a 1 (mais criativo)
        </div>
      </div>

      {/* Max Tokens */}
      <div className="form-field">
        <Input
          id="max-tokens"
          {...register('config.maxTokens', { valueAsNumber: true })}
          type="number"
          min="1"
          max="500"
          placeholder="Máximo de tokens"
          error={errors.config?.maxTokens?.message}
          disabled={isLoading}
          aria-label="Máximo de tokens"
          aria-describedby="tokens-description"
        />
        <div id="tokens-description" className="sr-only">
          Defina o limite máximo de tokens por resposta do assistente
        </div>
      </div>

      {/* Active Status */}
      <div className="form-field flex items-center space-x-2">
        <input
          {...register('isActive')}
          type="checkbox"
          id="is-active"
          className="h-4 w-4 rounded border-semantic-border text-primary-600 focus:ring-primary-500"
          aria-label="Ativar assistente"
          disabled={isLoading}
        />
        <label htmlFor="is-active" className="text-semantic-text-primary">
          Ativar assistente
        </label>
      </div>

      {/* Security and Validation Messages */}
      {securityState.securityIssues.length > 0 && (
        <div role="alert" className="text-error-500 text-sm">
          {securityState.securityIssues.map((issue, index) => (
            <p key={index}>{issue}</p>
          ))}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || isSubmitting || securityState.isRateLimited}
        className={`w-full px-4 py-2 rounded-md text-white font-medium
          ${isLoading || isSubmitting || securityState.isRateLimited
            ? 'bg-semantic-text-disabled cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
          }`}
        aria-busy={isLoading || isSubmitting}
      >
        {isLoading || isSubmitting ? 'Processando...' : 'Salvar Assistente'}
      </button>
    </form>
  );
});

AssistantForm.displayName = 'AssistantForm';

export default AssistantForm;