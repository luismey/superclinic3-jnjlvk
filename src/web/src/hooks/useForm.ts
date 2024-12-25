// External imports with versions
import { useForm as useReactHookForm } from 'react-hook-form'; // v7.0.0
import { zodResolver } from '@hookform/resolvers/zod'; // v3.0.0
import { z } from 'zod'; // v3.22.0
import { useState, useCallback, useEffect } from 'react'; // v18.0.0

// Internal imports
import { ApiError } from '../types/common';
import { validateFormData, validateWhatsAppData } from '../lib/validation';

// Security and validation constants
const SECURITY_CONFIG = {
  maxLength: 4096,
  rateLimitMs: 1000,
  sanitizationRules: 'strict',
  validationTimeout: 5000,
} as const;

const DEFAULT_FORM_OPTIONS = {
  mode: 'onBlur',
  reValidateMode: 'onChange',
  criteriaMode: 'all',
  shouldFocusError: true,
  delayError: 300,
} as const;

// Types for enhanced form state
interface SecurityState {
  isRateLimited: boolean;
  lastSubmitTime: number;
  securityIssues: string[];
}

interface ValidationState {
  isValidating: boolean;
  validationErrors: Record<string, string>;
  accessibilityHints: Record<string, string>;
}

interface EnhancedFormState<T> {
  securityState: SecurityState;
  validationState: ValidationState;
  formData: Partial<T>;
}

// Enhanced useForm hook with security features
export function useForm<T extends z.ZodType>(
  schema: T,
  options: Partial<typeof DEFAULT_FORM_OPTIONS> = {}
) {
  // Initialize form with react-hook-form
  const form = useReactHookForm({
    ...DEFAULT_FORM_OPTIONS,
    ...options,
    resolver: zodResolver(schema),
  });

  // Enhanced state management
  const [enhancedState, setEnhancedState] = useState<EnhancedFormState<z.infer<T>>>({
    securityState: {
      isRateLimited: false,
      lastSubmitTime: 0,
      securityIssues: [],
    },
    validationState: {
      isValidating: false,
      validationErrors: {},
      accessibilityHints: {},
    },
    formData: {},
  });

  // Security validation
  const validateSecurity = useCallback((data: unknown) => {
    const securityIssues: string[] = [];

    // Check for rate limiting
    const now = Date.now();
    const timeSinceLastSubmit = now - enhancedState.securityState.lastSubmitTime;
    const isRateLimited = timeSinceLastSubmit < SECURITY_CONFIG.rateLimitMs;

    if (isRateLimited) {
      securityIssues.push('Aguarde um momento antes de tentar novamente');
    }

    // Content length validation
    if (typeof data === 'object' && data !== null) {
      Object.values(data).forEach(value => {
        if (typeof value === 'string' && value.length > SECURITY_CONFIG.maxLength) {
          securityIssues.push('Conteúdo excede o limite permitido');
        }
      });
    }

    return { securityIssues, isRateLimited };
  }, [enhancedState.securityState.lastSubmitTime]);

  // Enhanced submit handler with security checks
  const handleSubmit = useCallback(
    (onSubmit: (data: z.infer<T>) => Promise<void> | void) => {
      return form.handleSubmit(async (data) => {
        // Security validation
        const { securityIssues, isRateLimited } = validateSecurity(data);
        
        if (isRateLimited || securityIssues.length > 0) {
          setEnhancedState(prev => ({
            ...prev,
            securityState: {
              ...prev.securityState,
              isRateLimited,
              securityIssues,
            },
          }));
          return;
        }

        // Form data validation
        setEnhancedState(prev => ({
          ...prev,
          validationState: { ...prev.validationState, isValidating: true },
        }));

        try {
          const validationResult = validateFormData(data, schema);
          
          if (!validationResult.success) {
            setEnhancedState(prev => ({
              ...prev,
              validationState: {
                isValidating: false,
                validationErrors: validationResult.errors || {},
                accessibilityHints: validationResult.accessibilityHints || {},
              },
            }));
            return;
          }

          // WhatsApp-specific validation if needed
          if ('phone' in data || 'message' in data) {
            const whatsAppResult = validateWhatsAppData(data as any);
            if (!whatsAppResult.success) {
              setEnhancedState(prev => ({
                ...prev,
                securityState: {
                  ...prev.securityState,
                  securityIssues: whatsAppResult.securityIssues || [],
                },
              }));
              return;
            }
          }

          // Update last submit time
          setEnhancedState(prev => ({
            ...prev,
            securityState: {
              ...prev.securityState,
              lastSubmitTime: Date.now(),
              securityIssues: [],
            },
            validationState: {
              isValidating: false,
              validationErrors: {},
              accessibilityHints: {},
            },
            formData: data,
          }));

          // Execute submit handler
          await onSubmit(data);

        } catch (error) {
          const apiError = error as ApiError;
          setEnhancedState(prev => ({
            ...prev,
            validationState: {
              isValidating: false,
              validationErrors: {
                submit: apiError.message || 'Erro ao processar formulário',
              },
              accessibilityHints: {
                'aria-invalid': 'true',
                'aria-errormessage': 'submit-error',
              },
            },
          }));
        }
      });
    },
    [form, schema, validateSecurity]
  );

  // Cleanup effect
  useEffect(() => {
    return () => {
      setEnhancedState(prev => ({
        ...prev,
        securityState: {
          isRateLimited: false,
          lastSubmitTime: 0,
          securityIssues: [],
        },
      }));
    };
  }, []);

  return {
    // Original form methods
    register: form.register,
    formState: form.formState,
    reset: form.reset,
    setValue: form.setValue,
    getValues: form.getValues,
    errors: form.formState.errors,
    isSubmitting: form.formState.isSubmitting,

    // Enhanced methods and state
    handleSubmit,
    securityState: enhancedState.securityState,
    validationState: enhancedState.validationState,
  };
}