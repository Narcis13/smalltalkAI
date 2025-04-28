/**
 * <ai_info>
 * This file defines the Workspace component, the primary area for users to
 * input, edit, and execute SON JSON code. It includes a code editor,
 * control buttons, and panels for displaying execution results and console output.
 * This version implements the core code execution functionality.
 * </ai_info>
 *
 * @file client/src/components/Workspace.tsx
 * @description Component providing the SON code editor, execution controls, and result/console display areas.
 *
 * Key features:
 * - Integrates `react-simple-code-editor` for SON JSON input.
 * - Manages editor content state using `useState`.
 * - Implements the "Execute" button logic:
 *    - Parses SON JSON input.
 *    - Retrieves the current SON environment from context.
 *    - Calls the `evaluate` function from the SON interpreter.
 *    - Displays the execution result or any errors encountered.
 * - Includes a "Save Method" button (placeholder).
 * - Provides distinct panels for results and console output (console output placeholder).
 * - Uses Tailwind CSS for layout (vertical flex column).
 *
 * @dependencies
 * - React: `useState`, `useContext`.
 * - react-simple-code-editor: For the code input area.
 * - prismjs: For syntax highlighting.
 * - ../contexts/SonEnvironmentContext: To access the SON environment (`useSonEnvironment` hook).
 * - ../lib/son/interpreter: The `evaluate` function.
 * - ../lib/son/errors: Custom SON error types (`SonError`).
 * - ./ui/Panel: Reusable panel component.
 * - ./ui/Button: Reusable button component.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Saving methods and console output logic will be implemented later.
 * - Requires `react-simple-code-editor` and `prismjs` to be installed.
 * - Handles basic JSON parsing errors and SON runtime errors during execution.
 */
"use client";

import React, { useState, useContext } from 'react'; // Import useContext
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css'; // Consider using a theme that works well in light/dark
import Panel from './ui/Panel';
import Button from './ui/Button';
import { useSonEnvironment } from '@/hooks/useSonEnvironment'; // Import the custom hook
import { evaluate } from '@/lib/son/interpreter'; // Import the evaluate function
import { SonError } from '@/lib/son/errors'; // Import base SonError for type checking
import { SonValue } from '@/lib/son/types'; // Import SonValue type

// Props interface (currently empty, can be expanded later)
interface WorkspaceProps {
  // Potentially add props later, e.g., to interact with SystemBrowser selection
}

/**
 * Formats the result for display. Handles different types appropriately.
 * @param value - The value returned from the SON evaluation.
 * @returns A string representation of the value.
 */
function formatResult(value: SonValue): string {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    // Use JSON.stringify for complex objects/arrays, handle potential circular refs if needed later
    try {
        // Nicely format objects and arrays
        if (typeof value === 'object' || Array.isArray(value)) {
            return JSON.stringify(value, null, 2);
        }
        // For primitives, convert to string directly
        return String(value);
    } catch (e) {
        // Fallback for values that cannot be stringified (e.g., complex non-JSON objects)
        return String(value);
    }
}

/**
 * Workspace Component
 *
 * Provides the main interaction area for writing and executing SON code.
 * Includes an editor, control buttons, and output panels.
 *
 * @param {WorkspaceProps} props - Component props.
 * @returns {JSX.Element} The Workspace component.
 */
export default function Workspace(props: WorkspaceProps): JSX.Element {
  // State to hold the SON JSON code entered by the user
  const [code, setCode] = useState<string>(
    // Initial example code
    '[\n  ["Transcript", "show:", "Hello from SON!"],\n  [1, "+", [2, "*", 3]]\n]'
  );

  // State for execution result and error messages
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get the environment context
  const { environment, isLoading: isEnvLoading, error: envError } = useSonEnvironment();

  /**
   * Handles the execution of the SON code in the editor.
   * Parses the code, evaluates it using the SON interpreter,
   * and updates the result or error state.
   */
  const handleExecute = () => {
    console.log("Execute button clicked. Code:", code);

    // Clear previous results/errors
    setResult(null);
    setError(null);

    // Check if environment is ready
    if (isEnvLoading) {
        setError("Execution failed: Environment is still loading.");
        return;
    }
    if (envError || !environment) {
        setError(`Execution failed: Environment error (${envError || 'Environment not available'}).`);
        return;
    }

    try {
      // 1. Parse the SON JSON from the editor
      const parsedCode = JSON.parse(code);

      // 2. Evaluate the parsed code using the interpreter and current environment
      console.log("Evaluating code with environment:", environment);
      const executionResult = evaluate(parsedCode, environment);
      console.log("Execution Result:", executionResult);

      // 3. Format and display the result
      setResult(formatResult(executionResult));

    } catch (e: any) {
      // Handle potential errors during parsing or evaluation
      console.error("Execution Error:", e);
      if (e instanceof SyntaxError) {
        // JSON Parsing Error
        setError(`JSON Syntax Error: ${e.message}`);
      } else if (e instanceof SonError) {
        // SON Runtime Error (VariableNotFound, MessageNotUnderstood, etc.)
        setError(`SON Runtime Error: ${e.message}`);
      } else if (e instanceof Error) {
        // Other JavaScript errors during execution (e.g., from JS bridge calls later)
        setError(`JavaScript Error: ${e.message}`);
      } else {
        // Unknown error type
        setError(`An unexpected error occurred: ${String(e)}`);
      }
    }
  };

  const handleSave = () => {
    console.log("Save Method button clicked. Code:", code);
    alert("Save Method functionality not yet implemented.");
    // Step 19 will implement this
  };

  return (
    // Use flex column layout to stack elements vertically
    // Use h-full and overflow-hidden to manage space within the IDE panel
    <div className="flex flex-col h-full p-2 space-y-2 bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* Code Editor Panel */}
      <Panel title="SON Editor" className="flex-grow flex flex-col overflow-hidden">
        {/* The editor itself, allow it to grow and scroll */}
        <div className="flex-grow overflow-auto relative border border-gray-200 dark:border-gray-700 rounded">
            <Editor
              value={code}
              onValueChange={newCode => setCode(newCode)}
              highlight={code => highlight(code, languages.json, 'json')}
              padding={10}
              textareaClassName="focus:outline-none"
              preClassName="min-h-full"
              style={{
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 13,
                backgroundColor: 'var(--editor-bg, #f8f8f8)', // Use CSS variable or default
                color: 'var(--editor-fg, #333)', // Use CSS variable or default
                minHeight: '100%',
              }}
            />
        </div>
      </Panel>

      {/* Control Buttons */}
      <div className="flex-shrink-0 flex space-x-2">
        <Button onClick={handleExecute} disabled={isEnvLoading}>
            {isEnvLoading ? 'Loading Env...' : 'Execute'}
        </Button>
        <Button onClick={handleSave} /* Add disabled logic later if needed */ >
          Save Method
        </Button>
      </div>

      {/* Results Panel - Updated to display result or error */}
      <Panel title="Result" className="flex-shrink-0 h-1/6 overflow-y-auto">
        <pre className="text-sm whitespace-pre-wrap">
          {error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : result !== null ? (
            <span className="text-gray-800 dark:text-gray-200">{result}</span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Execution results will appear here...</span>
          )}
        </pre>
      </Panel>

      {/* Console Output Panel */}
      <Panel title="Console" className="flex-shrink-0 h-1/6 overflow-y-auto">
        {/* Placeholder content */}
        <pre className="text-sm whitespace-pre-wrap">Transcript output will appear here...</pre>
        {/* Actual console output will go here in Step 18 */}
      </Panel>

    </div>
  );
}

// Basic CSS variables for editor background/foreground (can be moved to globals.css)
// This ensures basic visibility in light/dark mode if theme CSS isn't perfectly applied.
const editorStyles = `
  :root {
    --editor-bg: #ffffff;
    --editor-fg: #171717;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --editor-bg: #0f0f0f; /* Slightly off-black */
      --editor-fg: #e0e0e0;
    }
  }
`;

// Inject minimal styles for editor variables if needed (consider placing in globals.css)
if (typeof window !== 'undefined') { // Check if running in browser
    // Ensure the style tag isn't added multiple times if component re-renders heavily
    if (!document.getElementById('editor-styles')) {
        const styleTag = document.createElement('style');
        styleTag.id = 'editor-styles';
        styleTag.textContent = editorStyles;
        document.head.appendChild(styleTag);
    }
}