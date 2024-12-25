'use client';

import React from 'react'; // ^18.0.0
import Spinner from '../components/common/Spinner';

// Constants for accessibility and styling
const LOADING_ARIA_LABEL = 'Loading page content, please wait...';
const OVERLAY_OPACITY = 'bg-white/80';
const Z_INDEX_LOADING = 'z-50';

/**
 * Global loading component for Next.js 13+ app directory
 * Provides a consistent loading state during page transitions and data fetching
 * Implements design system loading indicators with proper accessibility
 * 
 * @returns {JSX.Element} Full-screen loading overlay with centered spinner
 */
export default function Loading(): JSX.Element {
  return (
    <div
      role="status"
      aria-label={LOADING_ARIA_LABEL}
      aria-live="polite"
      className={`
        fixed inset-0
        flex items-center justify-center
        ${OVERLAY_OPACITY}
        backdrop-blur-sm
        ${Z_INDEX_LOADING}
        will-change-transform
        transition-opacity duration-200
      `}
    >
      <div className="transform-gpu">
        <Spinner 
          size="lg"
          color="primary"
          className="motion-reduce:animate-[spin_1.5s_linear_infinite]"
        />
      </div>
    </div>
  );
}