/**
 * <ai_info>
 * This file defines the ConsoleOutput component, which is responsible for displaying
 * messages logged via the SON Transcript object during code execution. It receives
 * an array of messages and renders them in a simple, scrollable panel.
 * </ai_info>
 *
 * @file client/src/components/ConsoleOutput.tsx
 * @description Component to display messages from the SON Transcript.
 *
 * Key features:
 * - Receives an array of string messages via props.
 * - Renders messages within a `<pre>` tag to preserve whitespace.
 * - Displays a placeholder message when no output is present.
 * - Uses Tailwind CSS for styling.
 *
 * @dependencies
 * - React: Core library.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Designed to be used within the Workspace component.
 */
"use client";

import React from 'react';

interface ConsoleOutputProps {
  /** An array of messages to display in the console. */
  messages: string[];
  /** Optional additional CSS classes for the container */
  className?: string;
}

/**
 * ConsoleOutput Component
 *
 * Renders a list of messages, typically output from the SON Transcript.
 *
 * @param {ConsoleOutputProps} props - Component props.
 * @returns {JSX.Element} The ConsoleOutput component.
 */
export default function ConsoleOutput({ messages, className = "" }: ConsoleOutputProps): JSX.Element {
  return (
    <div className={`h-full overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded ${className}`}>
      <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
        {messages.length > 0
          ? messages.join('\n') // Join messages with newlines for display
          : <span className="text-gray-400 dark:text-gray-500 italic">Transcript output will appear here...</span>
        }
      </pre>
    </div>
  );
}