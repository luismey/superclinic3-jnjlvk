import { z } from 'zod'; // v3.22.0
import { useForm } from 'react-hook-form'; // v7.0.0
import { ApiError } from '../types/common';
import { validateEmail } from './string';
import { memo } from 'react';

// Constants for validation rules
const PHONE_REGEX = /^\+55([1-9][1-9])(9\d{8})$/;
const CAMPAIGN_NAME_REGEX = /^[a-zA-Z0-9\s-_]{3,50}$/;
const MAX_TEMPLATE_LENGTH = 1024;
const MAX_MEDIA_SIZE_MB = 16;
const PROHIBITED_KEYWORDS = ['spam', 'promocao', 'oferta', 'gratis', 'desconto', 'urgente', 'importante'];
const DDD_RANGES = { min: 11, max: 99 };
const VALIDATION_RATE_LIMIT = 100;

// Type definitions
interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  details?: Record<string, unknown>;
}

interface MessageTemplate {
  content: string;
  variables: string[];
  mediaAttachments?: {
    type: 'image' | 'video' | 'document';
    url: string;
    size: number;
  }[];
}

interface AssistantConfig {
  name: string;
  type: 'sales' | 'support' | 'appointment' | 'custom';
  promptTemplates: string[];
  responseConfig: {
    maxLength: number;
    tone: string;
    language: string;
  };
  securitySettings: {
    rateLimit: number;
    allowedDomains: string[];
    restrictedKeywords: string[];
  };
}

// Zod schemas for type-safe validation
const phoneNumberSchema = z.string().regex(PHONE_REGEX, 'Invalid Brazilian phone number format');

const campaignNameSchema = z.string()
  .regex(CAMPAIGN_NAME_REGEX, 'Invalid campaign name format')
  .refine(name => !PROHIBITED_KEYWORDS.some(keyword => 
    name.toLowerCase().includes(keyword)
  ), 'Campaign name contains prohibited keywords');

const messageTemplateSchema = z.object({
  content: z.string().max(MAX_TEMPLATE_LENGTH),
  variables: z.array(z.string()),
  mediaAttachments: z.array(z.object({
    type: z.enum(['image', 'video', 'document']),
    url: z.string().url(),
    size: z.number().max(MAX_MEDIA_SIZE_MB * 1024 * 1024)
  })).optional()
});

const assistantConfigSchema = z.object({
  name: z.string().min(3).max(50),
  type: z.enum(['sales', 'support', 'appointment', 'custom']),
  promptTemplates: z.array(z.string()),
  responseConfig: z.object({
    maxLength: z.number().positive(),
    tone: z.string(),
    language: z.string()
  }),
  securitySettings: z.object({
    rateLimit: z.number().min(1),
    allowedDomains: z.array(z.string()),
    restrictedKeywords: z.array(z.string())
  })
});

/**
 * Validates Brazilian phone numbers for WhatsApp Business API compliance
 * @param phoneNumber - Phone number to validate
 * @returns Validation result with detailed error messages if invalid
 */
export const validatePhoneNumber = memo((phoneNumber: string): ValidationResult => {
  try {
    // Sanitize input by removing non-numeric characters
    const sanitized = phoneNumber.replace(/\D/g, '');
    
    // Basic format validation
    const result = phoneNumberSchema.safeParse(phoneNumber);
    if (!result.success) {
      return {
        isValid: false,
        errors: ['Invalid phone number format'],
        details: result.error.format()
      };
    }

    // Extract DDD (area code)
    const ddd = parseInt(sanitized.substring(2, 4));
    if (ddd < DDD_RANGES.min || ddd > DDD_RANGES.max) {
      return {
        isValid: false,
        errors: ['Invalid area code (DDD)']
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Phone validation error:', error);
    return {
      isValid: false,
      errors: ['Validation system error']
    };
  }
});

/**
 * Validates WhatsApp campaign names with security checks
 * @param name - Campaign name to validate
 * @returns Validation result with security analysis
 */
export const validateCampaignName = memo((name: string): ValidationResult => {
  try {
    // Sanitize input to prevent XSS
    const sanitized = name.trim().replace(/[<>]/g, '');
    
    // Schema validation
    const result = campaignNameSchema.safeParse(sanitized);
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message)
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Campaign name validation error:', error);
    return {
      isValid: false,
      errors: ['Validation system error']
    };
  }
});

/**
 * Validates WhatsApp message templates for compliance and security
 * @param template - Message template to validate
 * @returns Detailed validation result with template analysis
 */
export const validateMessageTemplate = memo((template: MessageTemplate): ValidationResult => {
  try {
    // Schema validation
    const result = messageTemplateSchema.safeParse(template);
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message)
      };
    }

    // Variable placeholder validation
    const variableRegex = /{{[a-zA-Z0-9_]+}}/g;
    const foundVariables = template.content.match(variableRegex) || [];
    const declaredVariables = new Set(template.variables);
    
    if (foundVariables.some(v => !declaredVariables.has(v.slice(2, -2)))) {
      return {
        isValid: false,
        errors: ['Undeclared variables found in template']
      };
    }

    // Media validation
    if (template.mediaAttachments?.length) {
      const mediaValidation = template.mediaAttachments.every(attachment => 
        attachment.size <= MAX_MEDIA_SIZE_MB * 1024 * 1024
      );
      
      if (!mediaValidation) {
        return {
          isValid: false,
          errors: [`Media attachments must be under ${MAX_MEDIA_SIZE_MB}MB`]
        };
      }
    }

    return { isValid: true };
  } catch (error) {
    console.error('Template validation error:', error);
    return {
      isValid: false,
      errors: ['Validation system error']
    };
  }
});

/**
 * Validates virtual assistant configuration with security checks
 * @param config - Assistant configuration to validate
 * @returns Detailed configuration validation result
 */
export const validateAssistantConfig = memo((config: AssistantConfig): ValidationResult => {
  try {
    // Schema validation
    const result = assistantConfigSchema.safeParse(config);
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(e => e.message)
      };
    }

    // Security validations
    const securityChecks = [
      {
        check: config.securitySettings.rateLimit >= 1,
        message: 'Rate limit must be at least 1 request per minute'
      },
      {
        check: config.promptTemplates.every(prompt => 
          !config.securitySettings.restrictedKeywords.some(keyword => 
            prompt.toLowerCase().includes(keyword)
          )
        ),
        message: 'Prompts contain restricted keywords'
      },
      {
        check: config.securitySettings.allowedDomains.every(domain => 
          /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(domain)
        ),
        message: 'Invalid domain format in allowed domains'
      }
    ];

    const failedChecks = securityChecks
      .filter(check => !check.check)
      .map(check => check.message);

    if (failedChecks.length > 0) {
      return {
        isValid: false,
        errors: failedChecks
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Assistant config validation error:', error);
    return {
      isValid: false,
      errors: ['Validation system error']
    };
  }
});