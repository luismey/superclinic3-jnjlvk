import React, { useCallback, useMemo, useState, memo } from 'react';
import cn from 'classnames'; // v2.3.0
import { Pagination } from './Pagination';
import { Spinner } from './Spinner';
import { SortDirection } from '../../types/common';

// Constants
const DEFAULT_PAGE_SIZE = 10;
const EMPTY_STATE_MESSAGE = 'No data available';
const LOADING_ROW_COUNT = 5;
const VIRTUALIZATION_THRESHOLD = 100;
const SORT_DEBOUNCE_MS = 150;

// Interfaces
export interface TableColumn {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
  sortFn?: (a: any, b: any) => number;
}

export interface TableProps {
  columns: TableColumn[];
  data: any[];
  isLoading?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onSort?: (key: string, direction: SortDirection) => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  emptyStateMessage?: string;
  loadingRowCount?: number;
  virtualization?: boolean;
  className?: string;
  testId?: string;
}

/**
 * Enhanced table component implementing the design system with full accessibility support
 * Features include sorting, pagination, loading states, and WCAG 2.1 AA compliance
 */
export const Table = memo<TableProps>(({
  columns,
  data,
  isLoading = false,
  sortable = true,
  pagination = true,
  currentPage = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  totalItems = 0,
  onSort,
  onPageChange,
  onPageSizeChange,
  emptyStateMessage = EMPTY_STATE_MESSAGE,
  loadingRowCount = LOADING_ROW_COUNT,
  virtualization = false,
  className,
  testId,
}) => {
  // State
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.ASC);
  const [sortDebounce, setSortDebounce] = useState<NodeJS.Timeout>();

  // Memoized styles
  const styles = useMemo(() => ({
    container: cn(
      'w-full overflow-auto rounded-lg border border-semantic-border relative',
      className
    ),
    table: 'w-full border-collapse text-left table-fixed',
    header: cn(
      'bg-semantic-background-secondary font-medium',
      'p-3 border-b border-semantic-border',
      'sticky top-0 z-10'
    ),
    headerCell: (column: TableColumn) => cn(
      'p-3 text-sm font-semibold text-semantic-text-primary',
      column.sortable && sortable && 'cursor-pointer select-none',
      column.align === 'center' && 'text-center',
      column.align === 'right' && 'text-right'
    ),
    cell: (column: TableColumn) => cn(
      'p-3 border-b border-semantic-border text-sm',
      column.align === 'center' && 'text-center',
      column.align === 'right' && 'text-right'
    ),
    sortIcon: (isActive: boolean) => cn(
      'ml-2 transition-transform duration-200',
      isActive && sortDirection === SortDirection.DESC && 'transform rotate-180'
    ),
    loadingOverlay: cn(
      'absolute inset-0 bg-semantic-background/80',
      'flex items-center justify-center z-20'
    ),
    emptyState: 'p-8 text-center text-semantic-text-secondary'
  }), [sortable, sortDirection, className]);

  // Handle sort
  const handleSort = useCallback((columnKey: string) => {
    if (!sortable || !onSort) return;

    if (sortDebounce) clearTimeout(sortDebounce);

    const newDirection = columnKey === sortKey && sortDirection === SortDirection.ASC
      ? SortDirection.DESC
      : SortDirection.ASC;

    setSortKey(columnKey);
    setSortDirection(newDirection);

    // Announce sort change to screen readers
    const column = columns.find(col => col.key === columnKey);
    const message = `Table sorted by ${column?.header} in ${newDirection.toLowerCase()} order`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);

    // Debounce sort callback
    const timeout = setTimeout(() => {
      onSort(columnKey, newDirection);
    }, SORT_DEBOUNCE_MS);
    setSortDebounce(timeout);
  }, [sortable, onSort, sortKey, sortDirection, columns]);

  // Render sort icon
  const renderSortIcon = useCallback((columnKey: string) => {
    const isActive = sortKey === columnKey;
    return (
      <span 
        className={styles.sortIcon(isActive)}
        aria-hidden="true"
      >
        ▲
      </span>
    );
  }, [sortKey, styles]);

  // Calculate total pages
  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div 
      className={styles.container}
      data-testid={testId}
    >
      <table
        className={styles.table}
        role="grid"
        aria-busy={isLoading}
        aria-rowcount={totalItems}
      >
        <thead className={styles.header}>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className={styles.headerCell(column)}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
                role={column.sortable ? 'columnheader button' : 'columnheader'}
                aria-sort={
                  sortKey === column.key
                    ? sortDirection === SortDirection.ASC
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <div className="flex items-center">
                  {column.header}
                  {column.sortable && sortable && renderSortIcon(column.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading ? (
            Array.from({ length: loadingRowCount }).map((_, rowIndex) => (
              <tr key={`loading-${rowIndex}`}>
                {columns.map((column, colIndex) => (
                  <td
                    key={`loading-${rowIndex}-${colIndex}`}
                    className={styles.cell(column)}
                  >
                    <div className="h-4 bg-semantic-background-secondary animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr key={row.id || rowIndex}>
                {columns.map(column => (
                  <td
                    key={`${row.id || rowIndex}-${column.key}`}
                    className={styles.cell(column)}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className={styles.emptyState}
              >
                {emptyStateMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {isLoading && (
        <div className={styles.loadingOverlay}>
          <Spinner
            size="lg"
            color="primary"
            aria-label="Loading table data"
          />
        </div>
      )}

      {pagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
});

// Display name for debugging
Table.displayName = 'Table';

export default Table;