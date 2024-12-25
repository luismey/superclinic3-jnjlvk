'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/navigation';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';

// Registration form validation schema following security requirements
const registrationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s]*$/, 'Name can only contain letters and spaces'),
  
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    ),
  
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
  
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  
  organizationName: yup
    .string()
    .required('Organization name is required')
    .min(2, 'Organization name must be at least 2 characters'),
  
  phoneNumber: yup
    .string()
    .required('Phone number is required')
    .matches(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
});

type RegistrationFormData = yup.InferType<typeof registrationSchema>;

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const { register: registerUser, isLoading, error: authError } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<RegistrationFormData>({
    resolver: yupResolver(registrationSchema),
    mode: 'onBlur'
  });

  const onSubmit = async (data: RegistrationFormData) => {
    try {
      setSubmitError(null);
      
      // Register user with validated data
      await registerUser({
        email: data.email,
        password: data.password,
        name: data.name,
        organizationName: data.organizationName,
        phoneNumber: data.phoneNumber
      });

      // Redirect to dashboard on success
      router.push('/dashboard');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setSubmitError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </a>
          </p>
        </div>

        {/* Registration Form */}
        <form 
          onSubmit={handleSubmit(onSubmit)} 
          className="mt-8 space-y-6"
          noValidate
        >
          {/* Error Messages */}
          {(submitError || authError) && (
            <div
              role="alert"
              className="bg-error-50 border border-error-200 text-error-700 px-4 py-3 rounded relative"
              aria-live="polite"
            >
              {submitError || authError}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <Input
              id="name"
              type="text"
              {...register('name')}
              error={errors.name?.message}
              placeholder="Full Name"
              aria-label="Full Name"
              disabled={isLoading}
              required
            />

            <Input
              id="email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="Email Address"
              aria-label="Email Address"
              disabled={isLoading}
              required
            />

            <Input
              id="password"
              type="password"
              {...register('password')}
              error={errors.password?.message}
              placeholder="Password"
              aria-label="Password"
              disabled={isLoading}
              required
            />

            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
              placeholder="Confirm Password"
              aria-label="Confirm Password"
              disabled={isLoading}
              required
            />

            <Input
              id="organizationName"
              type="text"
              {...register('organizationName')}
              error={errors.organizationName?.message}
              placeholder="Organization Name"
              aria-label="Organization Name"
              disabled={isLoading}
              required
            />

            <Input
              id="phoneNumber"
              type="tel"
              {...register('phoneNumber')}
              error={errors.phoneNumber?.message}
              placeholder="Phone Number"
              aria-label="Phone Number"
              disabled={isLoading}
              required
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            fullWidth
            aria-label="Create account"
          >
            Create account
          </Button>

          {/* Terms and Privacy */}
          <p className="text-xs text-center text-gray-600">
            By creating an account, you agree to our{' '}
            <a 
              href="/terms" 
              className="font-medium text-primary-600 hover:text-primary-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a 
              href="/privacy" 
              className="font-medium text-primary-600 hover:text-primary-500"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;