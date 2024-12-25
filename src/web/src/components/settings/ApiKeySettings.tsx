import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import * as Dialog from '@radix-ui/react-dialog';
import Button from '../common/Button';
import { OrganizationService } from '../../services/organization';
import { UserRole } from '../../types/common';
import { ApiKey } from '../../types/organization';

// Constants
const API_KEY_PREFIX = 'pk_';
const MAX_API_KEYS = 5;
const KEY_EXPIRATION_DAYS = 90;
const KEY_ROTATION_WARNING_DAYS = 15;

// Types
interface ApiKeySettingsProps {
  userRole: UserRole;
  organizationId: string;
}

interface KeyUsageStats {
  requestCount: number;
  lastUsed: Date | null;
  errorRate: number;
}

interface KeyGenerationOptions {
  name: string;
  expiresInDays: number;
  scopes: string[];
}

/**
 * Component for managing API keys with enterprise-grade security features
 * Implements role-based access control, key rotation, and usage analytics
 */
export const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ userRole, organizationId }) => {
  // State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [keyStats, setKeyStats] = useState<Record<string, KeyUsageStats>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [revocationReason, setRevocationReason] = useState('');

  // Access control check
  const canManageKeys = [UserRole.ADMIN, UserRole.MANAGER].includes(userRole);

  // Load API keys and stats on mount
  useEffect(() => {
    if (canManageKeys) {
      loadApiKeys();
      startKeyRotationCheck();
    }
  }, [canManageKeys, organizationId]);

  /**
   * Loads existing API keys and their usage statistics
   */
  const loadApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      const keys = await OrganizationService.getApiKeys(organizationId);
      setApiKeys(keys);

      // Load usage stats for each key
      const stats: Record<string, KeyUsageStats> = {};
      await Promise.all(
        keys.map(async (key) => {
          stats[key.id] = await OrganizationService.getKeyUsageStats(key.id);
        })
      );
      setKeyStats(stats);
    } catch (error) {
      toast.error('Failed to load API keys');
      console.error('API key loading error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  /**
   * Generates a new API key with specified options
   */
  const generateApiKey = useCallback(async (options: KeyGenerationOptions) => {
    if (!canManageKeys) {
      toast.error('Insufficient permissions to manage API keys');
      return;
    }

    if (apiKeys.length >= MAX_API_KEYS) {
      toast.error(`Maximum of ${MAX_API_KEYS} API keys allowed`);
      return;
    }

    try {
      setIsLoading(true);
      const newKey = await OrganizationService.generateApiKey(organizationId, {
        name: options.name,
        expiresInDays: options.expiresInDays || KEY_EXPIRATION_DAYS,
        scopes: options.scopes,
        prefix: API_KEY_PREFIX
      });

      setApiKeys(prev => [...prev, newKey]);
      toast.success(
        'API key generated successfully. Please copy and store it securely - it won\'t be shown again.',
        { duration: 10000 }
      );

      return newKey;
    } catch (error) {
      toast.error('Failed to generate API key');
      console.error('API key generation error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canManageKeys, apiKeys.length, organizationId]);

  /**
   * Revokes an existing API key with audit logging
   */
  const revokeApiKey = useCallback(async (keyId: string, reason: string) => {
    if (!canManageKeys) {
      toast.error('Insufficient permissions to revoke API keys');
      return;
    }

    try {
      setIsLoading(true);
      await OrganizationService.revokeApiKey(organizationId, keyId, reason);
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success('API key revoked successfully');
    } catch (error) {
      toast.error('Failed to revoke API key');
      console.error('API key revocation error:', error);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setSelectedKeyId(null);
      setRevocationReason('');
    }
  }, [canManageKeys, organizationId]);

  /**
   * Checks for keys nearing expiration and sends notifications
   */
  const startKeyRotationCheck = useCallback(() => {
    const now = new Date();
    apiKeys.forEach(key => {
      const daysUntilExpiry = Math.ceil(
        (new Date(key.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry <= KEY_ROTATION_WARNING_DAYS) {
        toast.warning(
          `API key "${key.name}" will expire in ${daysUntilExpiry} days. Please rotate it.`,
          { duration: 10000 }
        );
      }
    });
  }, [apiKeys]);

  // Render helpers
  const renderKeyList = () => (
    <div className="space-y-4">
      {apiKeys.map(key => (
        <div key={key.id} className="p-4 border rounded-lg bg-white shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900">{key.name}</h4>
              <p className="text-sm text-gray-500">
                Created: {new Date(key.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                Expires: {new Date(key.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                Requests: {keyStats[key.id]?.requestCount || 0}
              </p>
              <p className="text-sm text-gray-500">
                Error rate: {(keyStats[key.id]?.errorRate || 0).toFixed(2)}%
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedKeyId(key.id);
                  setShowConfirmDialog(true);
                }}
                className="mt-2"
              >
                Revoke
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500">
            Manage API keys for integrating with the Porfin platform
          </p>
        </div>
        {canManageKeys && (
          <Button
            onClick={() => generateApiKey({
              name: `API Key ${apiKeys.length + 1}`,
              expiresInDays: KEY_EXPIRATION_DAYS,
              scopes: ['read', 'write']
            })}
            disabled={isLoading || apiKeys.length >= MAX_API_KEYS}
            loading={isLoading}
          >
            Generate New Key
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4">Loading...</div>
      ) : apiKeys.length === 0 ? (
        <p className="text-center text-gray-500 py-4">No API keys generated yet</p>
      ) : (
        renderKeyList()
      )}

      <Dialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-full max-w-md">
            <Dialog.Title className="text-lg font-medium mb-4">
              Revoke API Key
            </Dialog.Title>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Are you sure you want to revoke this API key? This action cannot be undone.
              </p>
              <textarea
                className="w-full border rounded-md p-2"
                placeholder="Reason for revocation (required)"
                value={revocationReason}
                onChange={(e) => setRevocationReason(e.target.value)}
              />
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => selectedKeyId && revokeApiKey(selectedKeyId, revocationReason)}
                  disabled={!revocationReason || isLoading}
                  loading={isLoading}
                >
                  Revoke Key
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

export default ApiKeySettings;