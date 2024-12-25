'use client';

import React, { useEffect, useState } from 'react'; // ^18.0.0
import { useParams } from 'next/navigation'; // ^14.0.0
import useCampaign from '../../../hooks/useCampaign';
import CampaignMetrics from '../../../components/campaigns/CampaignMetrics';
import { Card } from '../../../components/common/Card';
import { CampaignStatus } from '../../../types/campaign';
import { formatDate } from '../../../utils/date';
import { formatNumber } from '../../../utils/format';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const DEFAULT_LOCALE = 'pt-BR';

// Metric thresholds for alerts
const METRIC_THRESHOLDS = {
  deliveryRate: 95,
  errorRate: 5,
  messageDelay: 500
};

/**
 * Campaign details page component with real-time updates and comprehensive management features
 */
const CampaignPage: React.FC = () => {
  // Get campaign ID from route parameters
  const { id } = useParams();

  // Campaign state management
  const {
    selectedCampaign,
    loading,
    error,
    selectCampaign,
    updateCampaign,
    startCampaign,
    pauseCampaign,
    subscribeToUpdates
  } = useCampaign();

  // Local state for retry logic
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout>();

  /**
   * Handles campaign status updates with retry logic
   */
  const handleStatusUpdate = async (newStatus: CampaignStatus) => {
    try {
      if (newStatus === CampaignStatus.RUNNING) {
        await startCampaign(id as string);
      } else if (newStatus === CampaignStatus.PAUSED) {
        await pauseCampaign(id as string);
      }
      setRetryCount(0);
    } catch (error) {
      if (retryCount < MAX_RETRIES) {
        const timeout = setTimeout(() => {
          handleStatusUpdate(newStatus);
          setRetryCount(prev => prev + 1);
        }, RETRY_DELAY * (retryCount + 1));
        setRetryTimeout(timeout);
      } else {
        console.error('Failed to update campaign status:', error);
      }
    }
  };

  // Initialize campaign data and real-time updates
  useEffect(() => {
    if (id) {
      selectCampaign({ id } as any);
      const unsubscribe = subscribeToUpdates(id as string);
      return () => {
        unsubscribe?.();
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }
      };
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent" />
        <span className="sr-only">Carregando campanha...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4 p-6 bg-red-50" role="alert">
        <h2 className="text-lg font-semibold text-red-700">Erro ao carregar campanha</h2>
        <p className="mt-2 text-red-600">{error}</p>
        <button
          onClick={() => selectCampaign({ id } as any)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Tentar novamente
        </button>
      </Card>
    );
  }

  if (!selectedCampaign) {
    return (
      <Card className="m-4 p-6">
        <h2 className="text-lg font-semibold">Campanha não encontrada</h2>
        <p className="mt-2 text-gray-600">A campanha solicitada não está disponível.</p>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Campaign Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{selectedCampaign.name}</h1>
          <p className="text-gray-600 mt-1">{selectedCampaign.description}</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Campaign Status Badge */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            selectedCampaign.status === CampaignStatus.RUNNING
              ? 'bg-green-100 text-green-800'
              : selectedCampaign.status === CampaignStatus.PAUSED
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {selectedCampaign.status === CampaignStatus.RUNNING ? 'Em execução' :
             selectedCampaign.status === CampaignStatus.PAUSED ? 'Pausada' :
             selectedCampaign.status === CampaignStatus.COMPLETED ? 'Concluída' :
             'Agendada'}
          </span>

          {/* Campaign Controls */}
          {selectedCampaign.status !== CampaignStatus.COMPLETED && (
            <div className="flex gap-2">
              {selectedCampaign.status === CampaignStatus.RUNNING ? (
                <button
                  onClick={() => handleStatusUpdate(CampaignStatus.PAUSED)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                  aria-label="Pausar campanha"
                >
                  Pausar
                </button>
              ) : (
                <button
                  onClick={() => handleStatusUpdate(CampaignStatus.RUNNING)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  aria-label="Iniciar campanha"
                >
                  Iniciar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Campaign Metrics */}
      <CampaignMetrics
        campaign={selectedCampaign}
        showProgress={true}
        autoUpdate={selectedCampaign.status === CampaignStatus.RUNNING}
        refreshInterval={REFRESH_INTERVAL}
      />

      {/* Campaign Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Detalhes da Campanha</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Tipo</dt>
              <dd className="mt-1 text-sm text-gray-900">{selectedCampaign.type}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Data de Início</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(selectedCampaign.scheduleConfig.startTime, DATE_FORMATS.CAMPAIGN)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Taxa de Envio</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatNumber(selectedCampaign.rateLimit)} mensagens/minuto
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Configurações de Agendamento</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Horário de Envio</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {`${selectedCampaign.scheduleConfig.dailyStartHour}h às ${selectedCampaign.scheduleConfig.dailyEndHour}h`}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Dias Ativos</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {selectedCampaign.scheduleConfig.activeDays.map(day => 
                  ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][day]
                ).join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Fuso Horário</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {selectedCampaign.scheduleConfig.timezone}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
};

export default CampaignPage;