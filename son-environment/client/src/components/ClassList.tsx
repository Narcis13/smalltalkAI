/**
 * <ai_info>
 * This file defines the ClassList component, responsible for displaying a list of
 * SON class names fetched from the backend API. It manages its own state for
 * loading, errors, and the list of classes. It uses the generic ListView component
 * for rendering and handles user selection by calling a callback function.
 * </ai_info>
 *
 * @file client/src/components/ClassList.tsx
 * @description Component to display a list of SON classes fetched from the API.
 *
 * Key features:
 * - Fetches class names using `apiClient.getClasses` on mount.
 * - Manages loading and error states during the fetch.
 * - Uses the `ListView` component to render the list.
 * - Accepts `selectedClassName` prop to highlight the current selection.
 * - Calls `onClassSelect` callback when a class name is clicked.
 *
 * @dependencies
 * - React: `useState`, `useEffect`.
 * - ../lib/apiClient: `getClasses` function.
 * - ./ui/ListView: Generic list rendering component.
 *
 * @notes
 * - Marked as a client component ("use client").
 */
"use client";

import React, { useState, useEffect } from 'react';
import { getClasses } from '@/lib/apiClient';
import ListView from './ui/ListView'; // Import the generic ListView

interface ClassListProps {
  /** The currently selected class name (passed down for highlighting). */
  selectedClassName: string | null;
  /** Callback function triggered when a class is selected by the user. */
  onClassSelect: (className: string) => void;
  /** Optional additional CSS classes for the container */
  className?: string;
}

/**
 * ClassList Component
 *
 * Fetches and displays a list of SON class names from the backend API.
 * Allows users to select a class.
 *
 * @param {ClassListProps} props - Component props.
 * @returns {JSX.Element} The ClassList component.
 */
export default function ClassList({ selectedClassName, onClassSelect, className = "" }: ClassListProps): JSX.Element {
  const [classes, setClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true);
      setError(null);
      setClasses([]); // Clear previous classes while loading
      console.log("ClassList: Fetching classes...");
      try {
        const response = await getClasses();
        setClasses(response.classes);
        console.log("ClassList: Fetched classes:", response.classes);
      } catch (err: any) {
        console.error("ClassList: Failed to fetch classes:", err);
        setError(err.message || "Failed to load classes.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <ListView
      items={classes}
      selectedItem={selectedClassName}
      onSelect={onClassSelect} // Pass the callback directly to ListView
      isLoading={isLoading}
      error={error}
      title="Classes"
      loadingPlaceholder="Loading classes..."
      emptyPlaceholder="No classes defined."
      className={`min-h-[100px] ${className}`} // Add min-height to prevent collapse when empty/loading
    />
  );
}