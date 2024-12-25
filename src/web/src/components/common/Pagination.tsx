import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import cn from 'classnames'; // v2.3.0
import { Button } from './Button';
import { Select } from './Select';
import { theme } from '../../config/theme';

// Constants
const MAX_VISIBLE_PAGES = 5;
const DEBOUNCE_DELAY = 300;

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10 per page' },
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

// Interfaces
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
  ariaLabel?: string;
  showPageSizeSelector?: boolean;
  loading?: boolean;
  direction?: 'ltr' | 'rtl';
}

/**
 * Generates an array of page numbers with ellipsis for pagination display
 * @param currentPage Current active page
 * @param totalPages Total number of pages
 * @returns Array of page numbers with ellipsis indicators
 */
const getPageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  const leftBound = Math.max(1, currentPage - Math.floor(MAX_VISIBLE_PAGES / 2));
  const rightBound = Math.min(totalPages, leftBound + MAX_VISIBLE_PAGES - 1);

  // Add first page
  pages.push(1);

  // Add ellipsis after first page if needed
  if (leftBound > 2) {
    pages.push('...');
  }

  // Add visible page numbers
  for (let i = Math.max(2, leftBound); i <= Math.min(totalPages - 1, rightBound); i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if needed
  if (rightBound < totalPages - 1) {
    pages.push('...');
  }

  // Add last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

/**
 * Pagination component implementing the design system with enhanced accessibility
 * Compliant with WCAG 2.1 AA standards including keyboard navigation and screen reader support
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
  ariaLabel = 'Pagination',
  showPageSizeSelector = true,
  loading = false,
  direction = 'ltr',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Memoized page numbers array
  const pageNumbers = useMemo(() => 
    getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  // Handle page change with debounce
  const handlePageChange = useCallback((page: number) => {
    if (loading || page === currentPage || page < 1 || page > totalPages) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onPageChange(page);
    }, DEBOUNCE_DELAY);
  }, [currentPage, totalPages, loading, onPageChange]);

  // Handle page size change
  const handlePageSizeChange = useCallback((value: string) => {
    const newPageSize = parseInt(value, 10);
    const newTotalPages = Math.ceil(totalItems / newPageSize);
    const newCurrentPage = Math.min(currentPage, newTotalPages);
    
    onPageSizeChange(newPageSize);
    if (currentPage !== newCurrentPage) {
      onPageChange(newCurrentPage);
    }
  }, [currentPage, totalItems, onPageChange, onPageSizeChange]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Styles
  const styles = {
    container: cn(
      'flex items-center justify-between gap-4 p-4',
      'flex-wrap sm:flex-nowrap',
      direction === 'rtl' ? 'direction-rtl' : '',
      className
    ),
    pageInfo: cn(
      'flex items-center gap-2',
      'text-sm text-semantic-text-secondary'
    ),
    pageControls: cn(
      'flex items-center gap-1'
    ),
    pageButton: cn(
      'min-w-[40px] justify-center',
      'text-sm font-medium'
    ),
    ellipsis: cn(
      'px-2 py-1',
      'text-semantic-text-secondary'
    ),
  };

  const startItem = ((currentPage - 1) * pageSize) + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      ref={containerRef}
      aria-label={ariaLabel}
      className={styles.container}
      dir={direction}
    >
      {/* Page size selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2">
          <Select
            name="pageSize"
            label="Items per page"
            options={PAGE_SIZE_OPTIONS}
            value={pageSize.toString()}
            onChange={handlePageSizeChange}
            aria-label="Select number of items per page"
            disabled={loading}
          />
        </div>
      )}

      {/* Page information */}
      <div className={styles.pageInfo}>
        <span>
          Showing {startItem}-{endItem} of {totalItems} items
        </span>
      </div>

      {/* Page controls */}
      <div className={styles.pageControls}>
        {/* Previous page button */}
        <Button
          variant="outline"
          size="sm"
          className={styles.pageButton}
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          aria-label="Previous page"
        >
          ←
        </Button>

        {/* Page numbers */}
        {pageNumbers.map((page, index) => (
          page === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className={styles.ellipsis}
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <Button
              key={page}
              variant={currentPage === page ? 'primary' : 'outline'}
              size="sm"
              className={styles.pageButton}
              onClick={() => handlePageChange(page as number)}
              disabled={loading}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </Button>
          )
        ))}

        {/* Next page button */}
        <Button
          variant="outline"
          size="sm"
          className={styles.pageButton}
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          aria-label="Next page"
        >
          →
        </Button>
      </div>
    </nav>
  );
};

// Display name for debugging
Pagination.displayName = 'Pagination';

export default Pagination;