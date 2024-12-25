import { describe, test, expect } from '@jest/globals'; // v29.0.0
import {
  validatePhoneNumber,
  validateCampaignName,
  validateMessageTemplate,
  validateAssistantConfig
} from '../../src/utils/validation';

// Test data constants
const VALID_PHONE_NUMBERS = [
  '+5511999999999',
  '+5521988888888',
  '+5531977777777'
];

const INVALID_PHONE_NUMBERS = [
  '11999999999', // Missing country code
  '+5511', // Too short
  '+551199', // Invalid length
  'abc', // Non-numeric
  '+1234567890', // Invalid country code
  '+5500999999999', // Invalid DDD
  '+5599999999999' // Invalid format
];

const VALID_CAMPAIGN_NAMES = [
  'Black Friday 2024',
  'Natal_2024',
  'Campanha-Teste',
  'Promocao Verao'
];

const INVALID_CAMPAIGN_NAMES = [
  '<script>alert(1)</script>', // XSS attempt
  'spam_campaign', // Prohibited keyword
  'a', // Too short
  'extremely_long_campaign_name_that_exceeds_the_maximum_allowed_length_for_testing', // Too long
  'Promoção!@#', // Invalid special characters
  '' // Empty string
];

const VALID_MESSAGE_TEMPLATES = [
  {
    content: 'Olá {{1}}, seu pedido {{2}} está pronto!',
    variables: ['1', '2'],
    mediaAttachments: []
  },
  {
    content: 'Bem-vindo à {{1}}!',
    variables: ['1'],
    mediaAttachments: [{
      type: 'image',
      url: 'https://example.com/image.jpg',
      size: 1024 * 1024 // 1MB
    }]
  }
];

const INVALID_MESSAGE_TEMPLATES = [
  {
    content: 'Hello {{undeclared}}',
    variables: [],
    mediaAttachments: []
  },
  {
    content: 'Test',
    variables: ['unused'],
    mediaAttachments: [{
      type: 'video',
      url: 'invalid-url',
      size: 20 * 1024 * 1024 // 20MB (exceeds limit)
    }]
  }
];

const VALID_ASSISTANT_CONFIGS = [
  {
    name: 'Sales Bot',
    type: 'sales',
    promptTemplates: ['Como posso ajudar com sua compra?'],
    responseConfig: {
      maxLength: 500,
      tone: 'professional',
      language: 'pt-BR'
    },
    securitySettings: {
      rateLimit: 10,
      allowedDomains: ['example.com.br'],
      restrictedKeywords: ['senha', 'cpf', 'cartao']
    }
  }
];

const INVALID_ASSISTANT_CONFIGS = [
  {
    name: '', // Empty name
    type: 'invalid' as any,
    promptTemplates: [],
    responseConfig: {
      maxLength: -1,
      tone: '',
      language: ''
    },
    securitySettings: {
      rateLimit: 0,
      allowedDomains: ['invalid domain'],
      restrictedKeywords: []
    }
  }
];

describe('validatePhoneNumber', () => {
  test('should validate correct Brazilian phone numbers', () => {
    VALID_PHONE_NUMBERS.forEach(number => {
      const result = validatePhoneNumber(number);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  test('should reject invalid phone numbers', () => {
    INVALID_PHONE_NUMBERS.forEach(number => {
      const result = validatePhoneNumber(number);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  test('should handle edge cases and sanitization', () => {
    const result = validatePhoneNumber(' +5511999999999 ');
    expect(result.isValid).toBe(true);
  });

  test('should validate DDD ranges correctly', () => {
    const invalidDDD = validatePhoneNumber('+5500999999999');
    expect(invalidDDD.isValid).toBe(false);
    expect(invalidDDD.errors).toContain('Invalid area code (DDD)');
  });
});

describe('validateCampaignName', () => {
  test('should validate correct campaign names', () => {
    VALID_CAMPAIGN_NAMES.forEach(name => {
      const result = validateCampaignName(name);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  test('should reject invalid campaign names', () => {
    INVALID_CAMPAIGN_NAMES.forEach(name => {
      const result = validateCampaignName(name);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  test('should prevent XSS attempts', () => {
    const result = validateCampaignName('<script>alert("xss")</script>');
    expect(result.isValid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  test('should handle prohibited keywords', () => {
    const result = validateCampaignName('Spam Campaign 2024');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Campaign name contains prohibited keywords');
  });
});

describe('validateMessageTemplate', () => {
  test('should validate correct message templates', () => {
    VALID_MESSAGE_TEMPLATES.forEach(template => {
      const result = validateMessageTemplate(template);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  test('should reject invalid message templates', () => {
    INVALID_MESSAGE_TEMPLATES.forEach(template => {
      const result = validateMessageTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  test('should validate variable declarations', () => {
    const template = {
      content: 'Hello {{1}}, {{2}}!',
      variables: ['1'],
      mediaAttachments: []
    };
    const result = validateMessageTemplate(template);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Undeclared variables found in template');
  });

  test('should validate media attachments size', () => {
    const template = {
      content: 'Test',
      variables: [],
      mediaAttachments: [{
        type: 'image',
        url: 'https://example.com/large.jpg',
        size: 17 * 1024 * 1024 // 17MB
      }]
    };
    const result = validateMessageTemplate(template);
    expect(result.isValid).toBe(false);
    expect(result.errors?.[0]).toContain('16MB');
  });
});

describe('validateAssistantConfig', () => {
  test('should validate correct assistant configurations', () => {
    VALID_ASSISTANT_CONFIGS.forEach(config => {
      const result = validateAssistantConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  test('should reject invalid assistant configurations', () => {
    INVALID_ASSISTANT_CONFIGS.forEach(config => {
      const result = validateAssistantConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  test('should validate security settings', () => {
    const config = {
      ...VALID_ASSISTANT_CONFIGS[0],
      securitySettings: {
        rateLimit: 0, // Invalid
        allowedDomains: ['invalid domain'],
        restrictedKeywords: []
      }
    };
    const result = validateAssistantConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Rate limit must be at least 1 request per minute');
  });

  test('should validate domain format', () => {
    const config = {
      ...VALID_ASSISTANT_CONFIGS[0],
      securitySettings: {
        ...VALID_ASSISTANT_CONFIGS[0].securitySettings,
        allowedDomains: ['invalid@domain']
      }
    };
    const result = validateAssistantConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid domain format in allowed domains');
  });
});