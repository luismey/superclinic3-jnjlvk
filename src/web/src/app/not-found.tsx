'use client';

import Link from 'next/link'; // ^14.0.0
import Button from '../../components/common/Button';
import { ROUTES } from '../../config/routes';

/**
 * NotFound component - A responsive and accessible 404 error page
 * Implements WCAG 2.1 AA compliance with proper contrast ratios and keyboard navigation
 * Follows design system specifications for typography, spacing, and colors
 */
export default function NotFound() {
  return (
    <main 
      className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8"
      role="main"
      aria-labelledby="error-title"
    >
      {/* Error Status */}
      <div className="mb-8 text-center">
        <h1 
          id="error-title"
          className="mb-2 text-4xl font-bold text-gray-900"
          aria-label="404 - Page not found"
        >
          404
        </h1>
        <p className="text-xl font-medium text-gray-600">
          Página não encontrada
        </p>
      </div>

      {/* Error Description */}
      <div className="mb-8 max-w-md text-center">
        <p className="mb-4 text-base text-gray-600">
          Desculpe, não conseguimos encontrar a página que você está procurando. 
          Ela pode ter sido movida ou não existe mais.
        </p>
      </div>

      {/* Navigation Button */}
      <Link 
        href={ROUTES.PUBLIC_ROUTES[0].path} 
        className="inline-block"
        aria-label="Voltar para a página inicial"
      >
        <Button
          variant="primary"
          size="lg"
          className="min-w-[200px]"
        >
          Voltar para o início
        </Button>
      </Link>

      {/* Visual Decoration - Abstract Lines */}
      <div 
        className="absolute inset-0 -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute left-[50%] top-0 h-[1000px] w-[1000px] -translate-x-1/2 bg-gradient-to-b from-primary-50 to-transparent opacity-30" />
      </div>
    </main>
  );
}