import React, { useCallback, useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode.react'; // v3.1.0
import useWebSocket from 'react-use-websocket'; // v4.0.0
import { z } from 'zod'; // v3.22.0

import Button from '../common/Button';
import Input from '../common/Input';
import { useForm } from '../../hooks/useForm';
import { PHONE_REGEX } from '../../lib/validation';

// Constants
const QR_CODE_EXPIRY_MS = 60000; // 1 minute
const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
const RETRY_DELAY_MS = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;

// Validation schema for WhatsApp settings
const whatsAppSettingsSchema = z.object({
  phoneNumber: z.string()
    .regex(PHONE_REGEX, 'Número de telefone brasileiro inválido')
    .min(13, 'Número de telefone incompleto'),
  businessName: z.string()
    .min(2, 'Nome muito curto')
    .max(100, 'Nome muito longo'),
  businessDescription: z.string()
    .max(256, 'Descrição muito longa')
    .optional(),
  connectionType: z.enum(['web', 'business_api']),
  apiKey: z.string()
    .min(32, 'Chave API inválida')
    .optional()
    .nullable(),
});

// Types
interface WhatsAppSettingsProps {
  organizationId: string;
  currentSettings: WhatsAppSettings;
  onUpdate: (settings: WhatsAppSettings) => Promise<void>;
}

interface WhatsAppSettings {
  phoneNumber: string;
  businessName: string;
  businessDescription?: string;
  connectionType: 'web' | 'business_api';
  connectionStatus: 'connected' | 'disconnected' | 'pending' | 'error';
  apiKey: string | null;
  lastConnected: Date | null;
  errorCount: number;
  retryAttempts: number;
}

// WebSocket URL based on environment
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.porfin.com.br/ws';

export const WhatsAppSettings: React.FC<WhatsAppSettingsProps> = ({
  organizationId,
  currentSettings,
  onUpdate,
}) => {
  // State management
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState<Date | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  // Form handling with validation
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    securityState,
    validationState,
  } = useForm(whatsAppSettingsSchema);

  // WebSocket connection for real-time status updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `${WS_URL}/whatsapp/${organizationId}`,
    {
      shouldReconnect: () => true,
      reconnectInterval: RETRY_DELAY_MS,
      reconnectAttempts: MAX_RETRY_ATTEMPTS,
    }
  );

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        switch (data.type) {
          case 'qr_code':
            setQrCode(data.qrCode);
            setQrExpiry(new Date(Date.now() + QR_CODE_EXPIRY_MS));
            break;
          case 'connection_status':
            if (data.status === 'connected') {
              clearTimeout(connectionTimeoutRef.current);
              setIsConnecting(false);
              setConnectionError(null);
              onUpdate({
                ...currentSettings,
                connectionStatus: 'connected',
                lastConnected: new Date(),
                errorCount: 0,
                retryAttempts: 0,
              });
            }
            break;
          case 'error':
            handleConnectionError(data.message);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    }
  }, [lastMessage, currentSettings, onUpdate]);

  // Handle connection type change
  const handleConnectionTypeChange = useCallback(async (type: 'web' | 'business_api') => {
    // Clean up existing connection
    if (currentSettings.connectionStatus === 'connected') {
      sendMessage(JSON.stringify({ type: 'disconnect' }));
    }

    // Reset states
    setQrCode(null);
    setQrExpiry(null);
    setConnectionError(null);
    setIsConnecting(false);

    // Update form
    setValue('connectionType', type);
    if (type === 'web') {
      setValue('apiKey', null);
    }

    // Update settings
    await onUpdate({
      ...currentSettings,
      connectionType: type,
      connectionStatus: 'disconnected',
      apiKey: type === 'web' ? null : currentSettings.apiKey,
    });
  }, [currentSettings, setValue, onUpdate, sendMessage]);

  // Handle connection error
  const handleConnectionError = useCallback((error: string) => {
    setConnectionError(error);
    setIsConnecting(false);
    clearTimeout(connectionTimeoutRef.current);

    const newErrorCount = currentSettings.errorCount + 1;
    const shouldRetry = newErrorCount <= MAX_RETRY_ATTEMPTS;

    onUpdate({
      ...currentSettings,
      connectionStatus: 'error',
      errorCount: newErrorCount,
      retryAttempts: shouldRetry ? currentSettings.retryAttempts + 1 : currentSettings.retryAttempts,
    });

    if (shouldRetry) {
      setTimeout(() => {
        handleConnect();
      }, RETRY_DELAY_MS);
    }
  }, [currentSettings, onUpdate]);

  // Handle connection attempt
  const handleConnect = useCallback(() => {
    setIsConnecting(true);
    setConnectionError(null);

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      handleConnectionError('Tempo limite de conexão excedido');
    }, CONNECTION_TIMEOUT_MS);

    // Initiate connection based on type
    if (currentSettings.connectionType === 'web') {
      sendMessage(JSON.stringify({ type: 'request_qr' }));
    } else {
      sendMessage(JSON.stringify({
        type: 'connect_api',
        apiKey: currentSettings.apiKey,
      }));
    }
  }, [currentSettings, sendMessage]);

  // Form submission handler
  const onSubmit = async (data: z.infer<typeof whatsAppSettingsSchema>) => {
    try {
      await onUpdate({
        ...currentSettings,
        ...data,
        connectionStatus: currentSettings.connectionStatus,
        lastConnected: currentSettings.lastConnected,
        errorCount: currentSettings.errorCount,
        retryAttempts: currentSettings.retryAttempts,
      });
    } catch (error) {
      setConnectionError('Falha ao atualizar configurações');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(connectionTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-semibold text-gray-900">
        Configurações do WhatsApp
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Connection Type Selection */}
        <div className="flex space-x-4">
          <Button
            variant={currentSettings.connectionType === 'web' ? 'primary' : 'outline'}
            onClick={() => handleConnectionTypeChange('web')}
            type="button"
          >
            WhatsApp Web
          </Button>
          <Button
            variant={currentSettings.connectionType === 'business_api' ? 'primary' : 'outline'}
            onClick={() => handleConnectionTypeChange('business_api')}
            type="button"
          >
            Business API
          </Button>
        </div>

        {/* Basic Information */}
        <Input
          id="phoneNumber"
          label="Número do WhatsApp"
          {...register('phoneNumber')}
          error={errors.phoneNumber?.message}
          placeholder="+5511999999999"
        />

        <Input
          id="businessName"
          label="Nome da Empresa"
          {...register('businessName')}
          error={errors.businessName?.message}
        />

        <Input
          id="businessDescription"
          label="Descrição (opcional)"
          {...register('businessDescription')}
          error={errors.businessDescription?.message}
        />

        {/* API Key Input for Business API */}
        {currentSettings.connectionType === 'business_api' && (
          <Input
            id="apiKey"
            label="Chave API"
            type="password"
            {...register('apiKey')}
            error={errors.apiKey?.message}
          />
        )}

        {/* Connection Status and Controls */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Status da Conexão:
                <span className={`ml-2 ${
                  currentSettings.connectionStatus === 'connected' ? 'text-green-600' :
                  currentSettings.connectionStatus === 'error' ? 'text-red-600' :
                  currentSettings.connectionStatus === 'pending' ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  {currentSettings.connectionStatus === 'connected' ? 'Conectado' :
                   currentSettings.connectionStatus === 'error' ? 'Erro' :
                   currentSettings.connectionStatus === 'pending' ? 'Conectando' :
                   'Desconectado'}
                </span>
              </p>
              {currentSettings.lastConnected && (
                <p className="text-xs text-gray-500">
                  Última conexão: {new Date(currentSettings.lastConnected).toLocaleString()}
                </p>
              )}
            </div>

            <Button
              type="button"
              variant={currentSettings.connectionStatus === 'connected' ? 'outline' : 'primary'}
              onClick={currentSettings.connectionStatus === 'connected' ? 
                () => sendMessage(JSON.stringify({ type: 'disconnect' })) :
                handleConnect
              }
              loading={isConnecting}
              disabled={isSubmitting || securityState.isRateLimited}
            >
              {currentSettings.connectionStatus === 'connected' ? 'Desconectar' : 'Conectar'}
            </Button>
          </div>

          {/* QR Code Display */}
          {currentSettings.connectionType === 'web' && qrCode && qrExpiry && new Date() < qrExpiry && (
            <div className="flex flex-col items-center space-y-2">
              <QRCode value={qrCode} size={256} level="H" />
              <p className="text-sm text-gray-500">
                Escaneie o código QR no seu WhatsApp
              </p>
              <p className="text-xs text-gray-400">
                Expira em: {Math.ceil((qrExpiry.getTime() - Date.now()) / 1000)}s
              </p>
            </div>
          )}

          {/* Error Display */}
          {connectionError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                {connectionError}
              </p>
              {currentSettings.retryAttempts < MAX_RETRY_ATTEMPTS && (
                <p className="text-xs text-red-500 mt-1">
                  Tentando reconectar... ({currentSettings.retryAttempts + 1}/{MAX_RETRY_ATTEMPTS})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Save Settings Button */}
        <div className="mt-6">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isConnecting || securityState.isRateLimited}
            fullWidth
          >
            Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
};

export default WhatsAppSettings;