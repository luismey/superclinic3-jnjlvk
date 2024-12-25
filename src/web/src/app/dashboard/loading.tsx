'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '../../components/common/Skeleton';

/**
 * Loading component for the dashboard page that displays skeleton placeholders
 * while data is being fetched. Implements WCAG 2.1 AA compliant loading indicators
 * with proper responsive grid layout.
 *
 * @returns {JSX.Element} The rendered loading state component
 */
const Loading: React.FC = React.memo(() => {
  return (
    <div 
      className="w-full space-y-6 p-4"
      aria-busy="true"
      role="status"
      aria-label="Loading dashboard content"
    >
      {/* Metrics Section */}
      <section aria-label="Loading metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Quick Stats Cards */}
          {[
            'Total Chats',
            'Total Messages',
            'Conversion Rate',
            'Active Rate'
          ].map((metric) => (
            <div 
              key={metric}
              className="w-full h-[120px] rounded-lg"
              aria-label={`Loading ${metric} metric`}
            >
              <Skeleton
                className="mb-2"
                height={24}
                width="60%"
                variant="text"
                animation="pulse"
              />
              <Skeleton
                className="mb-2"
                height={36}
                width="80%"
                variant="text"
                animation="pulse"
              />
              <Skeleton
                height={20}
                width="40%"
                variant="text"
                animation="pulse"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Response Times Chart */}
      <section aria-label="Loading response times chart">
        <Skeleton
          className="mb-6"
          height={400}
          width="100%"
          variant="rectangular"
          animation="pulse"
        />
      </section>

      {/* Customer Journey */}
      <section aria-label="Loading customer journey">
        <Skeleton
          className="mb-6"
          height={200}
          width="100%"
          variant="rectangular"
          animation="pulse"
        />
      </section>

      {/* Action Buttons Placeholder */}
      <section 
        className="flex gap-4" 
        aria-label="Loading action buttons"
      >
        {[1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            height={40}
            width={120}
            variant="rectangular"
            animation="pulse"
          />
        ))}
      </section>
    </div>
  );
});

// Add display name for debugging
Loading.displayName = 'DashboardLoading';

export default Loading;