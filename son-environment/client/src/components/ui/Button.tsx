/**
 * <ai_info>
 * This file defines a simple, reusable Button component using Tailwind CSS.
 * It provides consistent styling for buttons across the application, handling
 * variants, hover/focus states, and disabled state.
 * </ai_info>
 *
 * @file client/src/components/ui/Button.tsx
 * @description Reusable Button component with Tailwind styling.
 *
 * Key features:
 * - Basic styling for primary actions.
 * - Hover and focus states.
 * - Disabled state styling.
 * - Allows passing standard button attributes (like onClick, type).
 * - Supports additional className prop for customization.
 *
 * @dependencies
 * - React: Core library.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Can be extended with different variants (secondary, destructive, etc.) later if needed.
 */
"use client";

import React from 'react';

// Inherit standard button props
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  // Add variant prop later if needed (e.g., 'primary', 'secondary')
  // variant?: 'primary' | 'secondary';
}

/**
 * Button Component
 *
 * A reusable button component with consistent styling.
 *
 * @param {ButtonProps} props - Component props, including standard button attributes.
 * @returns {JSX.Element} The Button component.
 */
export default function Button({ children, className = '', ...props }: ButtonProps): JSX.Element {
  // Base styles + primary variant styles (can be adapted)
  const baseStyles = `
    inline-flex items-center justify-center px-4 py-2 border border-transparent
    text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2
    focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800
    transition ease-in-out duration-150 disabled:opacity-50 disabled:cursor-not-allowed
  `;
  // Example primary button styles
  const primaryStyles = `
    text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600
  `;
  // Example secondary button styles (add later if needed)
  // const secondaryStyles = `
  //   text-blue-700 bg-blue-100 hover:bg-blue-200 dark:text-blue-300 dark:bg-blue-900 dark:hover:bg-blue-800
  // `;

  return (
    <button
      type="button" // Default to type="button" unless overridden
      className={`${baseStyles} ${primaryStyles} ${className}`} // Combine base, variant, and custom classes
      {...props} // Spread remaining props (like onClick, disabled, type)
    >
      {children}
    </button>
  );
}