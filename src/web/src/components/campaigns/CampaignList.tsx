import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { List, AutoSizer, WindowScroller } from 'react-virtualized'; // ^9.22.3
import clsx from 'clsx'; // ^2.0.0

import CampaignCard from './CampaignCard';
import Spinner from '../common/Spinner';
import { Campaign, CampaignStatus } from '../../types/campaign';
import useCampaign from '../../hooks/useCampaign';

// Constants for component configuration
const GRID_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

const ITEMS_PER_ROW = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 3,
};

const DEFAULT_ITEMS_PER_PAGE = 10;
const ROW_HEIGHT = 320; // Height of campaign card with margin

interface CampaignListProps {
  className?: string;
  onCreateCampaign?: () => void;
  onEditCampaign?: (id: string) => void;
  itemsPerPage?: number;
  enableVirtualization?: boolean;
  sortConfig?: {
    field: keyof Campaign;
    direction: 'asc' | 'desc';
  };
  filterConfig?: {
    status?: CampaignStatus[];
    search?: string;
  };
}

/**
 * CampaignList component displays a responsive, accessible grid of campaign cards
 * with support for virtualization, filtering, and real-time updates.
 */
export const CampaignList: React.FC<CampaignListProps> = ({
  className,
  onCreateCampaign,
  onEditCampaign,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  enableVirtualization = true,
  sortConfig,
  filterConfig,
}) => {
  // Campaign management hook
  const {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
  } = useCampaign();

  // Local state for window dimensions
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : GRID_BREAKPOINTS.lg
  );

  // Calculate items per row based on window width
  const itemsPerRow = useMemo(() => {
    if (windowWidth < GRID_BREAKPOINTS.md) return ITEMS_PER_ROW.sm;
    if (windowWidth < GRID_BREAKPOINTS.lg) return ITEMS_PER_ROW.md;
    return ITEMS_PER_ROW.lg;
  }, [windowWidth]);

  // Filter and sort campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];

    // Apply filters
    if (filterConfig) {
      if (filterConfig.status?.length) {
        result = result.filter(campaign => 
          filterConfig.status?.includes(campaign.status)
        );
      }
      if (filterConfig.search) {
        const searchLower = filterConfig.search.toLowerCase();
        result = result.filter(campaign =>
          campaign.name.toLowerCase().includes(searchLower) ||
          campaign.description.toLowerCase().includes(searchLower)
        );
      }
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.field];
        const bValue = b[sortConfig.field];
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        return aValue > bValue ? modifier : -modifier;
      });
    }

    return result;
  }, [campaigns, filterConfig, sortConfig]);

  // Handle campaign deletion with confirmation
  const handleDelete = useCallback(async (campaignId: string) => {
    try {
      if (!window.confirm('Are you sure you want to delete this campaign?')) {
        return;
      }
      await deleteCampaign(campaignId);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  }, [deleteCampaign]);

  // Handle campaign status changes
  const handleStatusChange = useCallback(async (campaignId: string, status: CampaignStatus) => {
    try {
      if (status === CampaignStatus.RUNNING) {
        await pauseCampaign(campaignId);
      } else if (status === CampaignStatus.PAUSED) {
        await startCampaign(campaignId);
      }
    } catch (error) {
      console.error('Failed to update campaign status:', error);
    }
  }, [pauseCampaign, startCampaign]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Render row for virtualized list
  const renderRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const fromIndex = index * itemsPerRow;
    const toIndex = Math.min(fromIndex + itemsPerRow, filteredCampaigns.length);
    const rowCampaigns = filteredCampaigns.slice(fromIndex, toIndex);

    return (
      <div
        style={style}
        className={clsx(
          'grid gap-4',
          {
            'grid-cols-1': itemsPerRow === 1,
            'grid-cols-2': itemsPerRow === 2,
            'grid-cols-3': itemsPerRow === 3,
          }
        )}
      >
        {rowCampaigns.map(campaign => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onEdit={() => onEditCampaign?.(campaign.id)}
            onDelete={() => handleDelete(campaign.id)}
            onStatusChange={(newStatus) => handleStatusChange(campaign.id, newStatus)}
          />
        ))}
      </div>
    );
  }, [filteredCampaigns, itemsPerRow, onEditCampaign, handleDelete, handleStatusChange]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div
      role="alert"
      className="p-4 bg-error-50 text-error-700 rounded-md"
    >
      <h2 className="text-lg font-semibold mb-2">Error Loading Campaigns</h2>
      <p>{error.message}</p>
      <button
        onClick={() => fetchCampaigns()}
        className="mt-2 text-error-600 hover:text-error-700 font-medium"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        className={clsx('campaign-list', className)}
        role="region"
        aria-label="Marketing Campaigns"
      >
        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center min-h-[200px]">
            <Spinner
              size="lg"
              color="primary"
              aria-label="Loading campaigns"
            />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div
            role="alert"
            className="p-4 bg-error-50 text-error-700 rounded-md"
          >
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredCampaigns.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No campaigns found</p>
            {onCreateCampaign && (
              <button
                onClick={onCreateCampaign}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Create your first campaign
              </button>
            )}
          </div>
        )}

        {/* Campaign Grid with Virtualization */}
        {!loading && !error && filteredCampaigns.length > 0 && (
          enableVirtualization ? (
            <WindowScroller>
              {({ height, isScrolling, registerChild, scrollTop }) => (
                <AutoSizer disableHeight>
                  {({ width }) => (
                    <div ref={registerChild as any}>
                      <List
                        autoHeight
                        height={height}
                        width={width}
                        isScrolling={isScrolling}
                        rowCount={Math.ceil(filteredCampaigns.length / itemsPerRow)}
                        rowHeight={ROW_HEIGHT}
                        rowRenderer={renderRow}
                        scrollTop={scrollTop}
                        overscanRowCount={2}
                      />
                    </div>
                  )}
                </AutoSizer>
              )}
            </WindowScroller>
          ) : (
            // Regular grid without virtualization
            <div className={clsx(
              'grid gap-4',
              {
                'grid-cols-1': itemsPerRow === 1,
                'grid-cols-2': itemsPerRow === 2,
                'grid-cols-3': itemsPerRow === 3,
              }
            )}>
              {filteredCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onEdit={() => onEditCampaign?.(campaign.id)}
                  onDelete={() => handleDelete(campaign.id)}
                  onStatusChange={(newStatus) => handleStatusChange(campaign.id, newStatus)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </ErrorBoundary>
  );
};

export default CampaignList;