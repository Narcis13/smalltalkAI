/**
 * <ai_info>
 * This file defines the CodeViewer component, responsible for fetching and displaying
 * the SON (Smalltalk Object Notation) source code for a specific method selected
 * in the System Browser. It takes the class name and method selector as props,
 * fetches the corresponding source code from the backend API, and renders it
 * in a readable, pretty-printed JSON format within a <pre> tag. It also handles
 * loading and error states during the fetch operation.
 * </ai_info>
 *
 * @file client/src/components/CodeViewer.tsx
 * @description Component to fetch and display SON method source code.
 *
 * Key features:
 * - Accepts `className` and `selector` props to identify the method.
 * - Fetches method source using `apiClient.getMethodSource` when props change.
 * - Manages loading and error states during the fetch.
 * - Displays the fetched SON JSON using `<pre>` and `JSON.stringify`.
 * - Shows appropriate messages when no method is selected, loading, or on error.
 *
 * @dependencies
 * - React: `useState`, `useEffect`.
 * - ../lib/apiClient: `getMethodSource` function and related types (`MethodSourceResponse`).
 * - ./ui/Panel: Reusable panel component for structure and title.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Uses `JSON.stringify` for pretty-printing; a dedicated syntax highlighter could be added later.
 */
"use client";

import React, { useState, useEffect } from 'react';
import { getMethodSource, MethodSourceResponse, SonValue } from '@/lib/apiClient';
import Panel from './ui/Panel'; // Assuming a reusable Panel component exists

interface CodeViewerProps {
  /** The name of the class containing the method. Null if no class selected. */
  className: string | null;
  /** The selector of the method to display. Null if no method selected. */
  selector: string | null;
  /** Optional additional CSS classes for the container */
  classNameContainer?: string; // Renamed to avoid conflict with component's className prop
}

/**
 * CodeViewer Component
 *
 * Fetches and displays the SON source code for a selected method.
 * Handles loading, error, and empty states.
 *
 * @param {CodeViewerProps} props - Component props.
 * @returns {JSX.Element} The CodeViewer component.
 */
export default function CodeViewer({ className, selector, classNameContainer = "" }: CodeViewerProps): JSX.Element {
  // State to hold the fetched method source (arguments and body)
  const [methodSource, setMethodSource] = useState<MethodSourceResponse | null>(null);
  // State to track loading status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // State to store any errors during fetch
  const [error, setError] = useState<string | null>(null);

  // Effect hook to fetch method source when className or selector changes
  useEffect(() => {
    // Only proceed if both className and selector are provided
    if (className && selector) {
      const fetchSource = async () => {
        setIsLoading(true);
        setError(null);
        setMethodSource(null); // Clear previous source while loading
        console.log(`CodeViewer: Fetching source for "${className} >> ${selector}"...`);
        try {
          // Call the API client function
          const response = await getMethodSource(className, selector);
          setMethodSource(response);
          console.log(`CodeViewer: Fetched source for "${className} >> ${selector}".`);
        } catch (err: any) {
          console.error(`CodeViewer: Failed to fetch source for "${className} >> ${selector}":`, err);
          setError(err.message || `Failed to load source code.`);
          // Keep methodSource null on error
        } finally {
          setIsLoading(false);
        }
      };

      fetchSource();
    } else {
      // If className or selector is missing, reset the state
      setMethodSource(null);
      setIsLoading(false);
      setError(null);
    }
  }, [className, selector]); // Re-run effect if className or selector changes

  // Function to render the content based on the current state
  const renderContent = () => {
    if (!className || !selector) {
      return <div className="p-4 text-center text-gray-500 dark:text-gray-400">Select a class and method to view code.</div>;
    }

    if (isLoading) {
      return <div className="p-4 text-center text-gray-500 dark:text-gray-400">{`Loading source for ${className} >> ${selector}...`}</div>;
    }

    if (error) {
      return <div className="p-4 text-center text-red-600 dark:text-red-400">Error: {error}</div>;
    }

    if (methodSource) {
      // Format the method definition as a SON literal array for display
      // This reconstructs the `define:args:body:` structure for clarity,
      // although the API only returns the core components.
      const displayJson: SonValue = [
        "define:args:body:", // Pseudo-form indicator
        methodSource.selector,
        methodSource.arguments,
        methodSource.body,
      ];

      return (
        <pre className="p-4 text-xs font-mono bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 overflow-auto h-full">
          {JSON.stringify(displayJson, null, 2)}
        </pre>
      );
    }

    // Should ideally not be reached if className and selector are present,
    // but acts as a fallback state.
    return <div className="p-4 text-center text-gray-500 dark:text-gray-400">No source code available.</div>;
  };

  // Determine the title for the panel
  const panelTitle = className && selector ? `${className} >> ${selector}` : "Code Viewer";

  return (
    // Use the Panel component for consistent styling
    <Panel title={panelTitle} className={`flex flex-col ${classNameContainer}`}>
      {/* Make the content area grow and allow scrolling */}
      <div className="flex-grow overflow-auto">
        {renderContent()}
      </div>
    </Panel>
  );
}