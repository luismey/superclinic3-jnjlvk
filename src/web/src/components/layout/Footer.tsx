import React, { memo, useCallback, useEffect, useState } from 'react';
import cn from 'classnames'; // v2.3.0
import { UI_CONSTANTS } from '../../config/constants';
import Button from '../common/Button';

// Types and Interfaces
interface FooterProps {
  className?: string;
  theme?: 'light' | 'dark';
}

interface WhatsAppVerificationStatus {
  isVerified: boolean;
  loading: boolean;
  error: string | null;
}

// Footer navigation links with ARIA labels
const FOOTER_LINKS = [
  {
    label: 'Termos de Uso',
    href: '/terms',
    ariaLabel: 'Acessar termos de uso',
  },
  {
    label: 'Privacidade',
    href: '/privacy',
    ariaLabel: 'Acessar política de privacidade',
  },
  {
    label: 'Ajuda',
    href: '/help',
    ariaLabel: 'Acessar central de ajuda',
  },
] as const;

/**
 * Custom hook to manage WhatsApp business verification status
 * @returns WhatsAppVerificationStatus object
 */
const useWhatsAppVerification = (): WhatsAppVerificationStatus => {
  const [status, setStatus] = useState<WhatsAppVerificationStatus>({
    isVerified: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const checkVerification = async () => {
      try {
        // Simulated API call - replace with actual verification endpoint
        const response = await fetch('/api/v1/whatsapp/verification');
        const data = await response.json();
        
        setStatus({
          isVerified: data.isVerified,
          loading: false,
          error: null,
        });
      } catch (error) {
        setStatus({
          isVerified: false,
          loading: false,
          error: 'Falha ao verificar status',
        });
      }
    };

    checkVerification();
  }, []);

  return status;
};

/**
 * Generates footer class names based on theme and design system
 * @param theme - Light or dark theme variant
 * @param className - Additional custom classes
 * @returns Combined class string
 */
const getFooterClasses = (theme: FooterProps['theme'] = 'light', className?: string): string => {
  return cn(
    // Base styles
    'w-full py-6 px-4',
    'border-t border-gray-200',
    'font-inter',
    
    // Responsive layout
    'grid grid-cols-1 gap-4',
    `md:grid-cols-2 md:gap-${UI_CONSTANTS.SPACING.MD}`,
    `lg:grid-cols-3 lg:gap-${UI_CONSTANTS.SPACING.LG}`,
    
    // Theme variants
    {
      'bg-white text-gray-600': theme === 'light',
      'bg-gray-900 text-gray-300 border-gray-700': theme === 'dark',
    },
    
    // Custom classes
    className
  );
};

/**
 * Footer component implementing the application's design system with WCAG 2.1 AA compliance
 * Provides consistent footer styling and structure across all pages
 */
export const Footer = memo<FooterProps>(({ className, theme = 'light' }) => {
  const currentYear = new Date().getFullYear();
  const verificationStatus = useWhatsAppVerification();
  
  // Handle verification status refresh
  const handleRefreshStatus = useCallback(async () => {
    // Implementation for refreshing verification status
  }, []);

  return (
    <footer 
      className={getFooterClasses(theme, className)}
      role="contentinfo"
      aria-label="Rodapé do site"
    >
      {/* Copyright and Verification Section */}
      <div className="flex flex-col space-y-2">
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        )}>
          © {currentYear} Porfin. Todos os direitos reservados.
        </p>
        
        {/* WhatsApp Business Verification Status */}
        <div className="flex items-center space-x-2">
          <span 
            className={cn(
              'inline-flex items-center text-sm',
              verificationStatus.isVerified ? 'text-green-600' : 'text-gray-500'
            )}
            role="status"
            aria-live="polite"
          >
            <svg
              className={cn(
                'w-4 h-4 mr-1.5',
                verificationStatus.isVerified ? 'text-green-500' : 'text-gray-400'
              )}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              {verificationStatus.isVerified ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              )}
            </svg>
            {verificationStatus.isVerified ? 'WhatsApp Business Verificado' : 'Verificação Pendente'}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshStatus}
            disabled={verificationStatus.loading}
            aria-label="Atualizar status de verificação"
            className="ml-2"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav
        className="flex flex-wrap gap-4 md:justify-center"
        aria-label="Links do rodapé"
      >
        {FOOTER_LINKS.map(({ label, href, ariaLabel }) => (
          <a
            key={href}
            href={href}
            className={cn(
              'text-sm hover:underline focus:outline-none',
              'focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'rounded-md px-2 py-1',
              theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            )}
            aria-label={ariaLabel}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Social Media Links */}
      <div className="flex justify-end space-x-4">
        {/* Social media icons with proper accessibility */}
        <a
          href="https://linkedin.com/company/porfin"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'text-gray-400 hover:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'rounded-md p-1'
          )}
          aria-label="Visite nossa página no LinkedIn"
        >
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
        </a>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;