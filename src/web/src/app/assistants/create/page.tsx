'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

// Internal imports
import { AssistantBuilder } from '../../../components/assistants/AssistantBuilder';
import { useAssistant } from '../../../hooks/useAssistant';
import { useAuth } from '../../../hooks/useAuth';
import { Assistant, AssistantType } from '../../../types/assistant';

// Validation schema for assistant creation
const createAssistantSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  type: z.nativeEnum(AssistantType),
  config: z.object({
    promptTemplate: z.string().min(1, 'Modelo de mensagem é obrigatório'),
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().positive().max(500),
  }),
  isActive: z.boolean(),
});

/**
 * Page component for creating new AI virtual assistants
 * Implements security, accessibility, and performance optimizations
 */
const CreateAssistantPage: React.FC = () => {
  // Hooks
  const router = useRouter();
  const { createAssistant, loading, error } = useAssistant();
  const { isAuthenticated, user } = useAuth();

  // Security check - verify authentication
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  /**
   * Handles successful assistant creation with proper error handling
   * and user feedback
   */
  const handleAssistantCreated = useCallback(async (assistant: Assistant) => {
    try {
      // Validate assistant data
      const validatedData = createAssistantSchema.parse(assistant);

      // Create assistant with loading state
      const loadingToast = toast.loading('Criando assistente...');
      await createAssistant({
        ...validatedData,
        organizationId: user?.organizationId,
      });

      // Success feedback
      toast.dismiss(loadingToast);
      toast.success('Assistente criado com sucesso!');

      // Navigate to assistants list
      router.push('/assistants');

    } catch (error) {
      // Error handling with user feedback
      toast.error(error instanceof Error 
        ? error.message 
        : 'Erro ao criar assistente'
      );

      // Log error for monitoring
      console.error('Assistant creation error:', error);
    }
  }, [createAssistant, router, user?.organizationId]);

  // Loading state
  if (loading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-label="Carregando..."
      >
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="p-4 bg-error-50 border border-error-200 rounded-md"
        role="alert"
      >
        <h2 className="text-error-800 font-semibold mb-2">
          Erro ao carregar
        </h2>
        <p className="text-error-600">{error}</p>
      </div>
    );
  }

  return (
    <main 
      className="container mx-auto px-4 py-8"
      role="main"
      aria-label="Criar novo assistente"
    >
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-semantic-text-primary">
            Criar Novo Assistente
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Configure seu assistente virtual com fluxos de conversa personalizados
          </p>
        </header>

        {/* Assistant Builder Component */}
        <AssistantBuilder
          onSave={handleAssistantCreated}
          initialData={{
            type: AssistantType.CUSTOMER_SERVICE,
            config: {
              temperature: 0.7,
              maxTokens: 150,
            },
            isActive: true,
          }}
          className="bg-white rounded-lg shadow-md"
          aria-label="Editor de assistente virtual"
        />
      </div>
    </main>
  );
};

export default CreateAssistantPage;