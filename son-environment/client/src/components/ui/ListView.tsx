/**
 * <ai_info>
 * This file defines a generic, reusable ListView component.
 * It handles rendering a list of items, displaying loading and error states,
 * managing item selection, and providing feedback on selection.
 * </ai_info>
 *
 * @file client/src/components/ui/ListView.tsx
 * @description Generic component for rendering selectable lists with loading/error states.
 *
 * Key features:
 * - Displays a list of string items.
 * - Shows loading indicator while data is fetching.
 * - Shows error message if data fetching fails.
 * - Shows "No items" message if the list is empty.
 * - Highlights the currently selected item.
 * - Calls an `onSelect` callback when an item is clicked.
 *
 * @dependencies
 * - React: Core library for component creation.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Styling uses Tailwind CSS.
 * - Designed to be used by components like ClassList and MethodList.
 */
"use client";

import React from 'react';

interface ListViewProps {
  /** The list of items to display (currently supports string items). */
  items: string[];
  /** The currently selected item (used for highlighting). */
  selectedItem: string | null;
  /** Callback function triggered when an item is selected. */
  onSelect: (item: string) => void;
  /** Indicates if the data for the list is currently being loaded. */
  isLoading: boolean;
  /** Stores any error message that occurred during data loading. */
  error: string | null;
  /** Optional title for the list view. */
  title?: string;
   /** Optional placeholder text when loading */
  loadingPlaceholder?: string;
  /** Optional placeholder text when no items are available */
  emptyPlaceholder?: string;
   /** Optional additional CSS classes for the container */
  className?: string;
}

/**
 * ListView Component
 *
 * Renders a selectable list of items, handling loading and error states.
 *
 * @param {ListViewProps} props - Component props.
 * @returns {JSX.Element} The ListView component.
 */
export default function ListView({
  items,
  selectedItem,
  onSelect,
  isLoading,
  error,
  title,
  loadingPlaceholder = "Loading...",
  emptyPlaceholder = "No items found.",
  className = ""
}: ListViewProps): JSX.Element {
  const renderContent = () => {
    if (isLoading) {
      return <div className="p-4 text-center text-gray-500 dark:text-gray-400">{loadingPlaceholder}</div>;
    }

    if (error) {
      return <div className="p-4 text-center text-red-600 dark:text-red-400">Error: {error}</div>;
    }

    if (items.length === 0) {
      return <div className="p-4 text-center text-gray-500 dark:text-gray-400">{emptyPlaceholder}</div>;
    }

    return (
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item) => (
          <li key={item}>
            <button
              onClick={() => onSelect(item)}
              className={`w-full text-left px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out ${
                selectedItem === item
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={`flex flex-col border border-gray-300 dark:border-gray-700 rounded-md shadow-sm overflow-hidden bg-white dark:bg-gray-800 ${className}`}>
       {title && (
        <div className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </div>
      )}
      <div className="overflow-y-auto flex-grow">
        {renderContent()}
      </div>
    </div>
  );
}