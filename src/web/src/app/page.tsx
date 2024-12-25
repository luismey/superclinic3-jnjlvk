'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import cn from 'classnames';

// Internal components
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

// Feature and benefit icons
const AIIcon = () => (
  <svg className="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const CampaignIcon = () => (
  <svg className="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="w-12 h-12 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Feature and benefit data
const FEATURES = [
  {
    title: 'AI-Powered Automation',
    description: 'Intelligent virtual assistants that handle customer inquiries 24/7',
    icon: AIIcon,
    ariaLabel: 'AI Automation Feature'
  },
  {
    title: 'WhatsApp Integration',
    description: "Seamless integration with Brazil's dominant messaging platform",
    icon: WhatsAppIcon,
    ariaLabel: 'WhatsApp Integration Feature'
  },
  {
    title: 'Campaign Management',
    description: 'Create and manage targeted messaging campaigns',
    icon: CampaignIcon,
    ariaLabel: 'Campaign Management Feature'
  },
  {
    title: 'Analytics Dashboard',
    description: 'Real-time insights into customer engagement',
    icon: AnalyticsIcon,
    ariaLabel: 'Analytics Dashboard Feature'
  }
] as const;

const BENEFITS = [
  {
    title: '30% Response Time Reduction',
    description: 'Faster customer service with automated responses',
    ariaLabel: 'Response Time Benefit'
  },
  {
    title: '50% More Inquiries Handled',
    description: 'Scale customer communication without increasing staff',
    ariaLabel: 'Inquiry Handling Benefit'
  },
  {
    title: '20% Higher Conversion',
    description: 'Improve sales through consistent follow-ups',
    ariaLabel: 'Conversion Rate Benefit'
  }
] as const;

// Metadata generation for SEO
export function generateMetadata() {
  return {
    title: 'Porfin - Automação WhatsApp com IA para Empresas',
    description: 'Otimize sua comunicação com clientes usando automação inteligente do WhatsApp. Aumente vendas e reduza custos com assistentes virtuais alimentados por IA.',
    openGraph: {
      title: 'Porfin - Automação WhatsApp com IA para Empresas',
      description: 'Otimize sua comunicação com clientes usando automação inteligente do WhatsApp.',
      images: ['/og-image.jpg'],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Porfin - Automação WhatsApp com IA',
      description: 'Automação inteligente do WhatsApp para empresas.',
      images: ['/twitter-image.jpg'],
    },
  };
}

// Main landing page component
export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      redirect('/dashboard');
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-12 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Header className="fixed top-0 w-full z-50" />

      {/* Hero Section */}
      <section className="pt-24 lg:pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
              Automatize seu WhatsApp com{' '}
              <span className="text-primary-600">Inteligência Artificial</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
              Otimize sua comunicação com clientes usando assistentes virtuais inteligentes. 
              Aumente vendas e reduza custos operacionais.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="primary"
                aria-label="Comece gratuitamente agora"
                className="min-w-[200px]"
              >
                Comece Grátis
              </Button>
              <Button
                size="lg"
                variant="outline"
                aria-label="Agende uma demonstração"
                className="min-w-[200px]"
              >
                Agendar Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto">
          <h2 id="features-heading" className="sr-only">
            Recursos da plataforma
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-lg border border-gray-200 hover:border-primary-500 transition-colors"
                aria-labelledby={`feature-${feature.title}`}
              >
                <feature.icon />
                <h3
                  id={`feature-${feature.title}`}
                  className="mt-4 text-lg font-semibold text-gray-900"
                >
                  {feature.title}
                </h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50" aria-labelledby="benefits-heading">
        <div className="max-w-7xl mx-auto">
          <h2 id="benefits-heading" className="text-3xl font-bold text-center text-gray-900 mb-12">
            Benefícios Comprovados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit.title}
                className="text-center p-6"
                aria-labelledby={`benefit-${benefit.title}`}
              >
                <h3
                  id={`benefit-${benefit.title}`}
                  className="text-2xl font-bold text-primary-600"
                >
                  {benefit.title}
                </h3>
                <p className="mt-2 text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Pronto para transformar sua comunicação?
          </h2>
          <p className="text-lg text-primary-100 mb-8">
            Comece gratuitamente hoje e veja os resultados em sua empresa.
          </p>
          <Button
            size="lg"
            variant="secondary"
            aria-label="Criar conta gratuita"
            className="bg-white text-primary-600 hover:bg-primary-50"
          >
            Criar Conta Gratuita
          </Button>
        </div>
      </section>

      <Footer />
    </main>
  );
}