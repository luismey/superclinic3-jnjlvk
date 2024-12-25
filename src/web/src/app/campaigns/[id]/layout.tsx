'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navigation from '../../../components/layout/Navigation';
import { Campaign, CampaignStatus } from '../../../types/campaign';
import { useAuth } from '../../../hooks/useAuth';

// Props interface for the layout component
interface CampaignLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

/**
 * Layout component for individual campaign pages that provides consistent structure
 * and campaign context for all campaign detail views.
 * 
 * @param props - Component props including children and navigation visibility
 * @returns Layout component with navigation and campaign context
 */
const CampaignLayout: React.FC<CampaignLayoutProps> = ({
  children,
  showNavigation = true
}) => {
  // Get campaign ID from route parameters
  const params = useParams();
  const campaignId = params?.id as string;

  // Authentication context
  const { isAuthenticated, user } = useAuth();

  // Local state for layout management
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Validate campaign access and setup
  useEffect(() => {
    const validateAccess = async () => {
      try {
        setIsLoading(true);
        
        // Validate authentication
        if (!isAuthenticated || !user) {
          throw new Error('Authentication required');
        }

        // Validate campaign ID
        if (!campaignId || typeof campaignId !== 'string') {
          throw new Error('Invalid campaign ID');
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    };

    validateAccess();
  }, [campaignId, isAuthenticated, user]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading campaign...</div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navigation sidebar */}
      {showNavigation && (
        <aside className="w-64 border-r border-gray-200 bg-white">
          <Navigation />
        </aside>
      )}

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CampaignLayout;