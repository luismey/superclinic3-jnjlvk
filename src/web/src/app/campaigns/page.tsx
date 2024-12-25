'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Spinner } from '../../components/common/Spinner';
import { CampaignList } from '../../components/campaigns/CampaignList';
import { CampaignMetrics } from '../../components/campaigns/CampaignMetrics';
import { useCampaign } from '../../hooks/useCampaign';
import { Campaign } from '../../types/campaign';

// Constants
const PAGE_TITLE = 'Campanhas de Marketing';
const REFRESH_INTERVAL = 30000; // 30 seconds
const ERROR_MESSAGES = {
  LOAD_ERROR: 'Erro ao carregar campanhas. Por favor, tente novamente.',
  CREATE_ERROR: 'Erro ao criar campanha. Por favor, tente novamente.',
  EDIT_ERROR: 'Erro ao editar campanha. Por favor, tente novamente.',
};

/**
 * CampaignsPage component implements the campaign management interface
 * with real-time updates, comprehensive error handling, and accessibility features.
 */
export default function CampaignsPage() {
  const router = useRouter();
  const {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    selectedCampaign,
  } = useCampaign();

  // Handle campaign creation navigation
  const handleCreateCampaign = useCallback(() => {
    try {
      router.push('/campaigns/create');
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error(ERROR_MESSAGES.CREATE_ERROR);
    }
  }, [router]);

  // Handle campaign edit navigation
  const handleEditCampaign = useCallback((campaignId: string) => {
    try {
      if (!campaignId) {
        throw new Error('Invalid campaign ID');
      }
      router.push(`/campaigns/${campaignId}`);
    } catch (error) {
      console.error('Navigation error:', error);
      throw new Error(ERROR_MESSAGES.EDIT_ERROR);
    }
  }, [router]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    try {
      await fetchCampaigns();
    } catch (error) {
      console.error('Refresh error:', error);
      throw new Error(ERROR_MESSAGES.LOAD_ERROR);
    }
  }, [fetchCampaigns]);

  // Set up automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(handleRefresh, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [handleRefresh]);

  // Initial data fetch
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <Card className="p-6 bg-error-50 text-error-700">
      <h2 className="text-lg font-semibold mb-2">Erro</h2>
      <p className="mb-4">{error.message}</p>
      <Button
        variant="outline"
        onClick={resetErrorBoundary}
        aria-label="Tentar novamente"
      >
        Tentar novamente
      </Button>
    </Card>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleRefresh}
    >
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            {PAGE_TITLE}
          </h1>
          <Button
            variant="primary"
            onClick={handleCreateCampaign}
            disabled={loading}
            aria-label="Criar nova campanha"
          >
            Nova Campanha
          </Button>
        </div>

        {/* Campaign Metrics Overview */}
        {selectedCampaign && (
          <CampaignMetrics
            campaign={selectedCampaign}
            showProgress
            autoUpdate
            refreshInterval={REFRESH_INTERVAL}
          />
        )}

        {/* Loading State */}
        {loading && !campaigns.length && (
          <div className="flex justify-center items-center min-h-[200px]">
            <Spinner
              size="lg"
              color="primary"
              aria-label="Carregando campanhas"
            />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="p-6 bg-error-50 text-error-700">
            <p>{error}</p>
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="mt-4"
              aria-label="Tentar novamente"
            >
              Tentar novamente
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && !campaigns.length && (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              Nenhuma campanha encontrada
            </h2>
            <p className="text-gray-600 mb-6">
              Crie sua primeira campanha para começar a enviar mensagens.
            </p>
            <Button
              variant="primary"
              onClick={handleCreateCampaign}
              aria-label="Criar primeira campanha"
            >
              Criar Campanha
            </Button>
          </Card>
        )}

        {/* Campaign List */}
        {!loading && !error && campaigns.length > 0 && (
          <CampaignList
            onCreateCampaign={handleCreateCampaign}
            onEditCampaign={handleEditCampaign}
            enableVirtualization
            sortConfig={{
              field: 'createdAt',
              direction: 'desc'
            }}
            className="mt-6"
          />
        )}
      </main>
    </ErrorBoundary>
  );
}

// Metadata for Next.js
export const metadata = {
  title: PAGE_TITLE,
  description: 'Gerencie suas campanhas de marketing do WhatsApp',
};