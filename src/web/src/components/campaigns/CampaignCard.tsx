import React, { useMemo, useCallback } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CampaignMetrics } from './CampaignMetrics';
import { Button } from '../common/Button';
import { Campaign, CampaignStatus } from '../../types/campaign';

// Types
interface CampaignCardProps {
  campaign: Campaign;
  className?: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  isLoading?: boolean;
  isMetricsEnabled?: boolean;
}

// Status badge variant mapping with accessibility labels
const getStatusBadgeVariant = (status: CampaignStatus): { variant: string; label: string } => {
  switch (status) {
    case CampaignStatus.RUNNING:
      return { variant: 'success', label: 'Campanha em execução' };
    case CampaignStatus.PAUSED:
      return { variant: 'warning', label: 'Campanha pausada' };
    case CampaignStatus.SCHEDULED:
      return { variant: 'info', label: 'Campanha agendada' };
    case CampaignStatus.COMPLETED:
      return { variant: 'secondary', label: 'Campanha concluída' };
    case CampaignStatus.FAILED:
      return { variant: 'error', label: 'Campanha falhou' };
    default:
      return { variant: 'secondary', label: 'Rascunho de campanha' };
  }
};

/**
 * CampaignCard component displays campaign information in a card format
 * with real-time metrics and action buttons.
 */
export const CampaignCard: React.FC<CampaignCardProps> = React.memo(({
  campaign,
  className,
  onEdit,
  onDelete,
  onPause,
  onResume,
  isLoading = false,
  isMetricsEnabled = true,
}) => {
  const { t } = useTranslation();
  
  // Memoized status badge configuration
  const statusBadge = useMemo(() => {
    const { variant, label } = getStatusBadgeVariant(campaign.status);
    return { variant, label };
  }, [campaign.status]);

  // Action handlers with loading state protection
  const handleEdit = useCallback(() => {
    if (!isLoading && onEdit) {
      onEdit(campaign.id);
    }
  }, [campaign.id, onEdit, isLoading]);

  const handleDelete = useCallback(() => {
    if (!isLoading && onDelete) {
      onDelete(campaign.id);
    }
  }, [campaign.id, onDelete, isLoading]);

  const handlePauseResume = useCallback(() => {
    if (isLoading) return;
    
    if (campaign.status === CampaignStatus.RUNNING && onPause) {
      onPause(campaign.id);
    } else if (campaign.status === CampaignStatus.PAUSED && onResume) {
      onResume(campaign.id);
    }
  }, [campaign.id, campaign.status, onPause, onResume, isLoading]);

  return (
    <Card
      className={clsx(
        'campaign-card',
        'transition-all duration-200',
        'hover:shadow-md',
        isLoading && 'opacity-70 pointer-events-none',
        className
      )}
      role="article"
      aria-label={`Campanha: ${campaign.name}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {campaign.name}
          </h3>
          <p className="text-sm text-gray-600">
            {campaign.description}
          </p>
        </div>
        
        <Badge
          variant={statusBadge.variant as any}
          size="md"
          className="ml-4"
          ariaLabel={statusBadge.label}
        >
          {t(`campaign.status.${campaign.status.toLowerCase()}`)}
        </Badge>
      </div>

      {/* Campaign Metrics */}
      {isMetricsEnabled && (
        <div className="mb-4">
          <CampaignMetrics
            campaign={campaign}
            showProgress
            autoUpdate={campaign.status === CampaignStatus.RUNNING}
            refreshInterval={30000}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mt-4">
        {campaign.status !== CampaignStatus.COMPLETED && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePauseResume}
            disabled={isLoading || ![CampaignStatus.RUNNING, CampaignStatus.PAUSED].includes(campaign.status)}
            aria-label={campaign.status === CampaignStatus.RUNNING ? 'Pausar campanha' : 'Retomar campanha'}
          >
            {campaign.status === CampaignStatus.RUNNING ? t('campaign.pause') : t('campaign.resume')}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          disabled={isLoading}
          aria-label="Editar campanha"
        >
          {t('campaign.edit')}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isLoading || campaign.status === CampaignStatus.RUNNING}
          className="text-error-600 hover:text-error-700"
          aria-label="Excluir campanha"
        >
          {t('campaign.delete')}
        </Button>
      </div>
    </Card>
  );
});

// Display name for debugging
CampaignCard.displayName = 'CampaignCard';

// Default export
export default CampaignCard;