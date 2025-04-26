/**
 * <ai_info>
 * This file defines the main Integrated Development Environment (IDE) layout component.
 * It structures the user interface into distinct areas for the System Browser and the Workspace,
 * using Tailwind CSS for flexible layout management. This component acts as the primary
 * container for the core interactive elements of the SON Environment.
 * </ai_info>
 *
 * @file client/src/components/IDE.tsx
 * @description Main layout component for the SON IDE interface.
 *
 * Key features:
 * - Uses Tailwind CSS Flexbox to create a two-column layout.
 * - Defines areas for the System Browser (left) and Workspace (right).
 * - Renders placeholder elements for `SystemBrowser` and `Workspace` components.
 * - Designed to fill the available vertical space within its parent container.
 *
 * @dependencies
 * - React: Core library for component creation.
 *
 * @notes
 * - Marked as a client component ("use client") as it's part of the interactive UI.
 * - The actual `SystemBrowser` and `Workspace` components will replace the placeholders later.
 * - Layout proportions (e.g., `w-1/3`, `w-2/3`) can be adjusted as needed.
 */
"use client";

import React from 'react';

/**
 * IDE Component
 *
 * Renders the main structural layout for the SON Environment's IDE,
 * dividing the space into sections for system browsing and code workspace.
 *
 * @returns {JSX.Element} The IDE layout structure.
 */
export default function IDE(): JSX.Element {
  return (
    // Flex container to manage the overall layout, allowing children to grow
    // Takes full height of its container (e.g., the main content area of the page)
    <div className="flex flex-grow h-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Left Panel: System Browser Area */}
      <div className="w-1/3 border-r border-gray-300 dark:border-gray-700 flex flex-col overflow-y-auto">
        {/* Placeholder for the SystemBrowser component */}
        <div className="p-4 h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800">
          <span className="text-gray-500 dark:text-gray-400">System Browser Placeholder</span>
          {/* Actual <SystemBrowser /> will go here */}
        </div>
      </div>

      {/* Right Panel: Workspace Area */}
      <div className="w-2/3 flex flex-col overflow-y-auto">
        {/* Placeholder for the Workspace component */}
        <div className="p-4 h-full flex items-center justify-center bg-white dark:bg-gray-900">
           <span className="text-gray-500 dark:text-gray-400">Workspace Placeholder</span>
          {/* Actual <Workspace /> will go here */}
        </div>
      </div>
    </div>
  );
}