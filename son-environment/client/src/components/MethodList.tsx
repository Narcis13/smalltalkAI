/**
 * <ai_info>
 * This file defines the MethodList component, responsible for fetching and displaying
 * a list of method selectors for a given SON class name from the backend API.
 * It manages loading and error states for the API call and uses the generic
 * ListView component for rendering.
 * </ai_info>
 *
 * @file client/src/components/MethodList.tsx
 * @description Component to display a list of method selectors for a selected class.
 *
 * Key features:
 * - Fetches method selectors using `apiClient.getMethods` when a class name is provided.
 * - Handles loading and error states during the fetch operation.
 * - Uses the `ListView` component for consistent list rendering and selection handling.
 * - Accepts `selectedClassName` to know which class's methods to fetch.
 * - Accepts `selectedMethodSelector` to highlight the currently selected method.
 * - Calls `onMethodSelect` callback when a method is selected.
 *
 * @dependencies
 * - React: `useState`, `useEffect`.
 * - ../lib/apiClient: `getMethods` function.
 * - ./ui/ListView: Generic list rendering component.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Handles the case where no class is selected (`selectedClassName` is null).
 */
"use client";

import React, { useState, useEffect } from 'react';
import { getMethods } from '@/lib/apiClient';
import ListView from './ui/ListView'; // Import the generic ListView

interface MethodListProps {
  /** The name of the class whose methods should be displayed. Null if no class selected. */
  selectedClassName: string | null;
  /** The currently selected method selector (passed down for highlighting). */
  selectedMethodSelector: string | null;
  /** Callback function triggered when a method selector is clicked by the user. */
  onMethodSelect: (selector: string) => void;
  /** Optional additional CSS classes for the container */
  className?: string;
}

/**
 * MethodList Component
 *
 * Fetches and displays a list of method selectors for the given `selectedClassName`.
 * Allows users to select a method from the list.
 *
 * @param {MethodListProps} props - Component props.
 * @returns {JSX.Element} The MethodList component.
 */
export default function MethodList({
  selectedClassName,
  selectedMethodSelector,
  onMethodSelect,
  className = ""
}: MethodListProps): JSX.Element {
  const [methods, setMethods] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Not loading initially
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch methods if a class name is actually selected
    if (selectedClassName) {
      const fetchMethods = async () => {
        setIsLoading(true);
        setError(null);
        setMethods([]); // Clear previous methods while loading
        console.log(`MethodList: Fetching methods for class "${selectedClassName}"...`);
        try {
          // Call the API client function to get methods for the selected class
          const response = await getMethods(selectedClassName);
          setMethods(response.methods);
          console.log(`MethodList: Fetched ${response.methods.length} methods for "${selectedClassName}".`);
        } catch (err: any) {
          console.error(`MethodList: Failed to fetch methods for "${selectedClassName}":`, err);
          setError(err.message || `Failed to load methods for ${selectedClassName}.`);
        } finally {
          setIsLoading(false);
        }
      };

      fetchMethods();
    } else {
      // If no class is selected, clear the methods list and reset state
      setMethods([]);
      setIsLoading(false);
      setError(null);
    }
  }, [selectedClassName]); // Dependency array: re-run effect when selectedClassName changes

  return (
    <ListView
      items={methods}
      selectedItem={selectedMethodSelector}
      onSelect={onMethodSelect} // Pass the selection handler down
      isLoading={isLoading}
      error={error}
      title="Methods"
      // Provide more specific placeholders based on whether a class is selected
      loadingPlaceholder={selectedClassName ? `Loading methods for ${selectedClassName}...` : "Select a class first"}
      emptyPlaceholder={selectedClassName ? `No methods found for ${selectedClassName}.` : "Select a class to view methods"}
      className={`min-h-[100px] ${className}`} // Add min-height
    />
  );
}