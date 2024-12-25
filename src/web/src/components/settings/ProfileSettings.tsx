import React, { useEffect, useState } from 'react';
import { z } from 'zod'; // v3.0.0
import toast from 'react-hot-toast'; // v2.4.1
import Input from '../common/Input';
import { useForm } from '../../hooks/useForm';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types/common';
import { theme } from '../../config/theme';

// Profile form validation schema with enhanced security rules
const profileSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode exceder 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Nome contém caracteres inválidos'),
  
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email não pode exceder 255 caracteres'),
  
  language: z.enum(['pt-BR', 'en-US'], {
    errorMap: () => ({ message: 'Idioma inválido' })
  }),
  
  notifications: z.boolean(),
  
  preferences: z.record(z.unknown()).default({})
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Auto-save debounce timeout in milliseconds
const AUTO_SAVE_DELAY = 1000;

/**
 * ProfileSettings component for managing user profile information
 * Implements WCAG 2.1 AA accessibility standards and secure data handling
 */
export const ProfileSettings: React.FC = () => {
  const { user, updateUser, csrfToken } = useAuth();
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout>();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with user data and validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, dirtyFields },
    reset,
    setValue
  } = useForm<ProfileFormData>({
    schema: profileSchema,
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      language: (user?.preferences?.language as 'pt-BR' | 'en-US') || 'pt-BR',
      notifications: user?.preferences?.notifications || false,
      preferences: user?.preferences || {}
    }
  });

  // Handle profile update with security measures
  const handleProfileUpdate = async (data: ProfileFormData) => {
    try {
      setIsSaving(true);

      // Validate data before submission
      const validatedData = profileSchema.parse(data);

      // Prepare update payload with only changed fields
      const updatePayload = Object.keys(dirtyFields).reduce((acc, key) => ({
        ...acc,
        [key]: validatedData[key as keyof ProfileFormData]
      }), {});

      // Update user profile with CSRF protection
      await updateUser({
        ...updatePayload,
        _csrf: csrfToken
      });

      toast.success('Perfil atualizado com sucesso');
      reset(data); // Reset form state after successful update

    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Erro ao atualizar perfil. Tente novamente.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (isDirty) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }

      const timeout = setTimeout(() => {
        handleSubmit(handleProfileUpdate)();
      }, AUTO_SAVE_DELAY);

      setAutoSaveTimeout(timeout);
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [isDirty, handleSubmit]);

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        language: user.preferences?.language || 'pt-BR',
        notifications: user.preferences?.notifications || false,
        preferences: user.preferences
      });
    }
  }, [user, reset]);

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h1 className={`${theme.typography.sizes['2xl']} font-semibold mb-6`}>
        Configurações do Perfil
      </h1>

      <form 
        onSubmit={handleSubmit(handleProfileUpdate)}
        className="space-y-6"
        noValidate
      >
        {/* Name field */}
        <div>
          <Input
            id="name"
            {...register('name')}
            type="text"
            label="Nome"
            required
            error={errors.name?.message}
            aria-describedby="name-description"
          />
          <p 
            id="name-description" 
            className="mt-1 text-sm text-semantic-text-secondary"
          >
            Seu nome completo como será exibido no sistema.
          </p>
        </div>

        {/* Email field */}
        <div>
          <Input
            id="email"
            {...register('email')}
            type="email"
            label="Email"
            required
            error={errors.email?.message}
            aria-describedby="email-description"
          />
          <p 
            id="email-description" 
            className="mt-1 text-sm text-semantic-text-secondary"
          >
            Seu email principal para comunicações.
          </p>
        </div>

        {/* Language selection */}
        <div>
          <label 
            htmlFor="language"
            className="block text-sm font-medium text-semantic-text-primary"
          >
            Idioma
          </label>
          <select
            id="language"
            {...register('language')}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 
                     focus:outline-none focus:ring-primary-500 focus:border-primary-500 
                     rounded-md"
            aria-describedby="language-description"
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
          </select>
          {errors.language && (
            <p className="mt-1 text-sm text-error-500">{errors.language.message}</p>
          )}
        </div>

        {/* Notifications toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label 
              htmlFor="notifications"
              className="text-sm font-medium text-semantic-text-primary"
            >
              Notificações
            </label>
            <p 
              id="notifications-description"
              className="text-sm text-semantic-text-secondary"
            >
              Receber atualizações sobre suas conversas.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            id="notifications"
            {...register('notifications')}
            aria-checked={Boolean(user?.preferences?.notifications)}
            className={`${
              user?.preferences?.notifications ? 'bg-primary-600' : 'bg-gray-200'
            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            onClick={() => setValue('notifications', !user?.preferences?.notifications)}
          >
            <span
              className={`${
                user?.preferences?.notifications ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className={`${
              isDirty && !isSaving
                ? 'bg-primary-600 hover:bg-primary-700'
                : 'bg-gray-300 cursor-not-allowed'
            } px-4 py-2 text-white rounded-md focus:outline-none 
            focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
            transition-colors`}
            aria-busy={isSaving}
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {/* Auto-save indicator */}
      {isDirty && (
        <p 
          role="status"
          className="mt-4 text-sm text-semantic-text-secondary text-center"
        >
          Alterações serão salvas automaticamente...
        </p>
      )}
    </div>
  );
};

export default ProfileSettings;