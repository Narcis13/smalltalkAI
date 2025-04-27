/**
 * <ai_info>
 * This file defines a simple, reusable Panel component.
 * It provides a consistent container style with borders and padding for different UI sections.
 * </ai_info>
 *
 * @file client/src/components/ui/Panel.tsx
 * @description Reusable Panel component for consistent UI section styling.
 *
 * Key features:
 * - Provides a div container with standard border, padding, and background.
 * - Accepts children elements to render inside the panel.
 * - Supports optional className prop for additional styling.
 *
 * @dependencies
 * - React: Core library for component creation.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Styling is done using Tailwind CSS utility classes.
 */
"use client";

import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string; // Allow passing additional classes
  title?: string;     // Optional title for the panel
}

/**
 * Panel Component
 *
 * A simple container component with consistent border and padding.
 *
 * @param {PanelProps} props - Component props.
 * @param {React.ReactNode} props.children - Content to render inside the panel.
 * @param {string} [props.className] - Optional additional CSS classes.
 * @param {string} [props.title] - Optional title displayed above the content.
 * @returns {JSX.Element} The Panel component.
 */
export default function Panel({ children, className = '', title }: PanelProps): JSX.Element {
  return (
    <div className={`border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      {title && (
        <div className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300">
          {title}
        </div>
      )}
      <div className="p-2"> {/* Padding applied to inner div to not interfere with border/title */}
        {children}
      </div>
    </div>
  );
}