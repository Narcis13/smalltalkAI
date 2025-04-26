/**
 * <ai_info>
 * This file defines the main page component for the SON Environment application.
 * It renders the primary IDE layout by including the `IDE` component.
 * Marked as a client component ("use client") as per project rules.
 * </ai_info>
 *
 * @file client/src/app/page.tsx
 * @description The main page component for the SON Environment application.
 *
 * @dependencies
 * - React: Core library.
 * - ../components/IDE: The main IDE layout component.
 *
 * @notes
 * - Uses "use client" directive.
 * - Renders the <IDE /> component, which contains the structure for the Workspace and System Browser.
 * - Uses Flexbox layout to ensure the IDE fills the available page space.
 */
"use client"; // Enforce client-side rendering for this page

import React from 'react';
import IDE from '@/components/IDE'; // Import the main IDE layout component

/**
 * The main page component for the SON Environment.
 * Renders the primary user interface by displaying the IDE layout.
 *
 * @returns {JSX.Element} The main page content.
 */
export default function Home(): React.ReactNode {
  return (
    // Use flex-grow to make this page fill the <main> tag area in the layout
    // Use flex and flex-col to allow the content (IDE) to stretch vertically
    <div className="flex-grow flex flex-col p-4 h-full">
      <h1 className="text-2xl font-bold text-sky-700 dark:text-sky-400 mb-4">SON Environment</h1>
      {/* Render the main IDE component, allowing it to take available space */}
      <div className="flex-grow flex">
        <IDE />
      </div>
    </div>
  );
}