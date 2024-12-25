'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '../../components/common/Skeleton';

/**
 * Loading state component for the settings page.
 * Displays skeleton placeholders while settings data is being fetched.
 * Implements WCAG 2.1 AA compliant loading indicators with responsive layout.
 *
 * @returns {JSX.Element} The rendered loading state component
 */
export default function SettingsLoading(): JSX.Element {
  return (
    <div
      className="w-full p-6 space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-8"
      role="status"
      aria-busy="true"
      aria-label="Loading settings page content"
    >
      {/* Profile Settings Section */}
      <section className="space-y-6">
        <Skeleton 
          variant="text"
          width={200}
          height={24}
          className="mb-8"
          animation="pulse"
        />

        {/* Profile Form Fields */}
        {[...Array(3)].map((_, index) => (
          <div key={`profile-field-${index}`} className="space-y-2">
            <Skeleton 
              variant="text"
              width={120}
              height={16}
              animation="pulse"
            />
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={40}
              animation="pulse"
            />
          </div>
        ))}

        {/* Save Button Placeholder */}
        <Skeleton 
          variant="rectangular"
          width={120}
          height={40}
          className="mt-8"
          animation="pulse"
        />
      </section>

      {/* Organization Settings Section */}
      <section className="space-y-6">
        <Skeleton 
          variant="text"
          width={250}
          height={24}
          className="mb-8"
          animation="pulse"
        />

        {/* Organization Form Fields */}
        {[...Array(4)].map((_, index) => (
          <div key={`org-field-${index}`} className="space-y-2">
            <Skeleton 
              variant="text"
              width={140}
              height={16}
              animation="pulse"
            />
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={40}
              animation="pulse"
            />
          </div>
        ))}

        {/* Plan Details Card */}
        <div className="mt-8">
          <Skeleton 
            variant="rectangular"
            width="100%"
            height={80}
            className="rounded-lg"
            animation="pulse"
          />
        </div>

        {/* Settings Toggles */}
        {[...Array(2)].map((_, index) => (
          <div key={`toggle-${index}`} className="flex items-center space-x-4">
            <Skeleton 
              variant="rectangular"
              width={40}
              height={24}
              animation="pulse"
            />
            <Skeleton 
              variant="text"
              width={200}
              height={16}
              animation="pulse"
            />
          </div>
        ))}
      </section>

      {/* Hidden text for screen readers */}
      <span className="sr-only">
        Loading settings page content. Please wait...
      </span>
    </div>
  );
}

// Add display name for debugging
SettingsLoading.displayName = 'SettingsLoading';