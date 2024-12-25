import { z } from 'zod'; // v3.22.0
import { useForm } from 'react-hook-form'; // v7.0.0
import { ApiError } from '../types/common';

// Brazilian phone number regex with optional 9th digit
export const PHONE_REGEX = /^\+55\d{2}9?\d{8}$/;

// WhatsApp message constraints
export const MAX_MESSAGE_LENGTH = 4096;
export const MAX_MEDIA_SIZE_MB = 16;

// Content filtering for prohibited terms in Portuguese
export const PROHIBITED_CONTENT = [
  'spam', 'promocao', 'oferta', 'gratis',
  'virus', 'malware', 'phishing', 'scam'
];

/**
 * Configuration interface for validation schema creation
 */
interface SchemaConfig {
  rules: Record<string, z.ZodType>;
  messages?: Record<string, string>;
  security?: {
    sanitize?: boolean;
    maxLength?: number;
    allowHtml?: boolean;
  };
}

/**
 * Validation result interface with detailed error information
 */
interface ValidationResult {
  success: boolean;
  errors?: Record<string, string>;
  securityIssues?: string[];
  accessibilityHints?: Record<string, string>;
}

/**
 * WhatsApp specific data validation interface
 */
interface WhatsAppData {
  phone: string;
  message: string;
  media?: {
    type: 'image' | 'video' | 'document';
    size: number;
    mimeType: string;
  };
}

/**
 * Creates a comprehensive Zod validation schema with enhanced security rules
 * and Brazilian Portuguese error messages
 */
export function createValidationSchema(config: SchemaConfig): z.ZodSchema {
  const { rules, messages = {}, security = {} } = config;

  // Default security settings
  const securityConfig = {
    sanitize: true,
    maxLength: 1000,
    allowHtml: false,
    ...security
  };

  // Custom error map for Portuguese messages
  const errorMap: z.ZodErrorMap = (issue, ctx) => {
    const message = messages[issue.code] || ctx.defaultError;
    return { message };
  };

  // Create base schema from rules
  let schema = z.object(rules);

  // Add security validation transforms
  if (securityConfig.sanitize) {
    schema = schema.transform((data) => {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitized[key] = value
            .trim()
            .replace(/[<>]/g, '') // Basic XSS prevention
            .slice(0, securityConfig.maxLength);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    });
  }

  return schema.setErrorMap(errorMap);
}

/**
 * Validates form data with enhanced security checks and accessibility support
 */
export function validateFormData(
  formData: any,
  schema: z.ZodSchema
): ValidationResult {
  try {
    // Validate against schema
    schema.parse(formData);

    return {
      success: true,
      accessibilityHints: {
        'aria-invalid': 'false',
        'aria-describedby': ''
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      const accessibilityHints: Record<string, string> = {};

      error.errors.forEach((err) => {
        const field = err.path.join('.');
        errors[field] = err.message;
        accessibilityHints[`${field}-error`] = `aria-describedby="${field}-error"`;
      });

      return {
        success: false,
        errors,
        accessibilityHints: {
          'aria-invalid': 'true',
          ...accessibilityHints
        }
      };
    }

    throw error;
  }
}

/**
 * Validates WhatsApp-specific data with Brazilian format checks
 * and content filtering
 */
export function validateWhatsAppData(data: WhatsAppData): ValidationResult {
  const securityIssues: string[] = [];
  
  // Create WhatsApp validation schema
  const whatsAppSchema = z.object({
    phone: z.string()
      .regex(PHONE_REGEX, 'Número de telefone brasileiro inválido')
      .min(13, 'Número de telefone incompleto')
      .max(14, 'Número de telefone muito longo'),
    
    message: z.string()
      .min(1, 'Mensagem não pode estar vazia')
      .max(MAX_MESSAGE_LENGTH, 'Mensagem excede o limite do WhatsApp')
      .refine(
        (msg) => !PROHIBITED_CONTENT.some(term => 
          msg.toLowerCase().includes(term)
        ),
        'Mensagem contém conteúdo proibido'
      ),

    media: z.object({
      type: z.enum(['image', 'video', 'document']),
      size: z.number()
        .max(MAX_MEDIA_SIZE_MB * 1024 * 1024, 'Arquivo muito grande'),
      mimeType: z.string()
        .refine(
          (mime) => {
            const allowedTypes = [
              'image/jpeg', 'image/png', 'video/mp4',
              'application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            return allowedTypes.includes(mime);
          },
          'Tipo de arquivo não suportado'
        )
    }).optional()
  });

  try {
    // Validate data
    whatsAppSchema.parse(data);

    // Additional security checks
    if (data.message.includes('<script>')) {
      securityIssues.push('Tentativa de injeção de script detectada');
    }

    if (data.message.match(/https?:\/\//g)?.length > 3) {
      securityIssues.push('Número excessivo de links detectado');
    }

    return {
      success: securityIssues.length === 0,
      securityIssues: securityIssues.length > 0 ? securityIssues : undefined
    };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: Object.fromEntries(
          error.errors.map(err => [
            err.path.join('.'),
            err.message
          ])
        )
      };
    }

    throw error;
  }
}

/**
 * Hook for form validation with React Hook Form integration
 */
export function useFormValidation<T extends z.ZodType>(schema: T) {
  return useForm({
    mode: 'onChange',
    resolver: async (data) => {
      try {
        const validated = await schema.parseAsync(data);
        return {
          values: validated,
          errors: {}
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = Object.fromEntries(
            error.errors.map(err => [
              err.path.join('.'),
              { type: 'validation', message: err.message }
            ])
          );
          return {
            values: {},
            errors
          };
        }
        throw error;
      }
    }
  });
}