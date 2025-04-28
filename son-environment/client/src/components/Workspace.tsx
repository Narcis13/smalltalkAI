/**
 * <ai_info>
 * This file defines the Workspace component, the primary area for users to
 * input, edit, execute, and save SON JSON code. It includes a code editor,
 * control buttons (Execute, Save Method), an input for the target class name,
 * and panels for displaying execution results, console output, and save status messages.
 * It handles code execution, Transcript output, and saving method definitions via the backend API.
 * </ai_info>
 *
 * @file client/src/components/Workspace.tsx
 * @description Component providing the SON code editor, execution/save controls, result/console/status displays.
 *
 * Key features:
 * - Integrates `react-simple-code-editor` for SON JSON input.
 * - Manages editor content state (`code`).
 * - Manages target class name state for saving (`targetClassName`).
 * - Manages saving status and loading states (`isSaving`, `saveStatus`).
 * - Implements the "Execute" button logic:
 *    - Parses SON JSON input.
 *    - Retrieves the current SON environment from context.
 *    - Injects a `Transcript` object into the environment.
 *    - Calls the `evaluate` function from the SON interpreter.
 *    - Displays the execution result or errors.
 *    - Collects and displays messages sent to `Transcript show:`.
 * - Implements the "Save Method" button logic:
 *    - Requires user input for the target class name.
 *    - Parses the editor content, validating it's a `define:args:body:` structure.
 *    - Extracts selector, arguments, and body.
 *    - Calls `apiClient.saveMethod` to persist the definition.
 *    - Displays success or error messages in the status area.
 * - Provides distinct panels for results and console output.
 * - Uses Tailwind CSS for layout (vertical flex column).
 *
 * @dependencies
 * - React: `useState`, `useContext`, `ChangeEvent`.
 * - react-simple-code-editor: For the code input area.
 * - prismjs: For syntax highlighting.
 * - ../contexts/SonEnvironmentContext: To access the SON environment (`useSonEnvironment` hook).
 * - ../lib/apiClient: The `saveMethod` function.
 * - ../lib/son/interpreter: The `evaluate` function.
 * - ../lib/son/errors: Custom SON error types (`SonError`).
 * - ./ui/Panel: Reusable panel component.
 * - ./ui/Button: Reusable button component.
 * - ./ConsoleOutput: Component to display console messages.
 *
 * @notes
 * - Marked as a client component ("use client").
 * - Requires `react-simple-code-editor` and `prismjs` to be installed.
 * - Saving a method requires the user to manually refresh the page/environment to see the changes reflected in the System Browser or runtime.
 */
"use client";

import React, { useState, useContext, ChangeEvent } from 'react'; // Import useContext, ChangeEvent
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-tomorrow.css'; // Consider using a theme that works well in light/dark
import Panel from './ui/Panel';
import Button from './ui/Button';
import ConsoleOutput from './ConsoleOutput'; // Import the ConsoleOutput component
import { useSonEnvironment } from '@/hooks/useSonEnvironment'; // Import the custom hook
import { evaluate } from '@/lib/son/interpreter'; // Import the evaluate function
import { SonError } from '@/lib/son/errors'; // Import base SonError for type checking
import { SonValue } from '@/lib/son/types'; // Import SonValue type
import { saveMethod as apiSaveMethod } from '@/lib/apiClient'; // Alias apiClient function

// Props interface (currently empty, can be expanded later)
interface WorkspaceProps {
  // Potentially add props later, e.g., to interact with SystemBrowser selection
}

/**
 * Formats a value for display in the results panel.
 * Handles different types appropriately, including pretty-printing objects/arrays.
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
    // Special handling for Block closures for better display
    if (typeof value === 'object' && value?.__type === 'SonBlock') {
        return `[BlockClosure args: ${JSON.stringify(value.argNames)}]`;
    }

    try {
        // Nicely format objects and arrays
        if (typeof value === 'object' || Array.isArray(value)) {
            return JSON.stringify(value, null, 2);
        }
        // For primitives, convert to string directly
        return String(value);
    } catch (e) {
        // Fallback for values that cannot be stringified
        console.warn("Could not stringify result:", value, e);
        try {
            return String(value);
        } catch (strErr) {
            return "[Unrepresentable Result]";
        }
    }
}

/**
 * Converts a value passed to Transcript show: into a string for display.
 * @param arg - The argument passed to Transcript show:.
 * @returns String representation.
 */
function transcriptShowToString(arg: SonValue): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
        if (arg.__type === 'SonBlock') return `[BlockClosure args: ${JSON.stringify(arg.argNames)}]`;
        try {
            // Attempt to stringify simply first
            return JSON.stringify(arg);
        } catch (e) {
            // Fallback for complex objects or those with circular refs
            return Object.prototype.toString.call(arg);
        }
    }
    return String(arg);
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
    // Initial example code using the $Transcript variable
    '[\n  ["$Transcript", "show:", "Starting execution..."],\n  ["$Transcript", "show:", ["The result is: ", [1, "+", [2, "*", 3]]]],\n  ["$Transcript", "cr"],\n  ["$Transcript", "show:", "Finished."],\n  [1, "+", 2]\n]'
    // Example method definition:
    // '["define:args:body:", "double:", ["x"], [["^", ["$x", "*", 2]]]]'
  );

  // State for execution result and error messages
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // State for console output messages
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  // State for saving functionality
  const [targetClassName, setTargetClassName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null); // For save success/error messages


  // Get the environment context
  const { environment, isLoading: isEnvLoading, error: envError } = useSonEnvironment();

  /**
   * Handles the execution of the SON code in the editor.
   * Parses the code, injects Transcript, evaluates it using the SON interpreter,
   * and updates the result, console, or error state.
   */
  const handleExecute = () => {
    console.log("Execute button clicked. Code:", code);

    // Clear previous results/errors/console/status
    setResult(null);
    setError(null);
    setConsoleOutput([]);
    setSaveStatus(null); // Clear save status on execute

    // Check if environment is ready
    if (isEnvLoading) {
        setError("Execution failed: Environment is still loading.");
        return;
    }
    if (envError || !environment) {
        setError(`Execution failed: Environment error (${envError || 'Environment not available'}).`);
        return;
    }

    // --- Transcript Injection ---
    const transcriptObject = {
        'show:': (arg: SonValue) => {
            const message = transcriptShowToString(arg);
            console.log("Transcript show:", message); // Log to browser console as well
            setConsoleOutput(prev => [...prev, message]);
            return transcriptObject;
        },
        'cr': () => {
            setConsoleOutput(prev => [...prev, '']);
            return transcriptObject;
        }
    };
    try {
         environment.set('Transcript', transcriptObject);
         console.log("Injected/Set Transcript object into environment:", environment);
    } catch (injectError: any) {
        setError(`Failed to inject Transcript: ${injectError.message}`);
        return; // Stop execution if injection fails
    }

    // --- Evaluation ---
    try {
      const parsedCode = JSON.parse(code);
      if (!environment) throw new Error("Environment not available for evaluation.");
      const executionResult = evaluate(parsedCode, environment);
      console.log("Execution Result:", executionResult);
      setResult(formatResult(executionResult));

    } catch (e: any) {
      console.error("Execution Error:", e);
      if (e instanceof SyntaxError) {
        setError(`JSON Syntax Error: ${e.message}`);
      } else if (e instanceof SonError) {
        setError(`SON Runtime Error: ${e.message}`);
      } else if (e instanceof Error) {
        setError(`JavaScript Error: ${e.message}`);
      } else {
        setError(`An unexpected error occurred: ${String(e)}`);
      }
    } finally {
        // Cleanup? For now, leave Transcript injected.
    }
  };

  /**
   * Handles saving the method definition from the editor to the backend.
   */
  const handleSave = async () => {
    console.log("Save Method button clicked. Code:", code);
    setIsSaving(true);
    setSaveStatus(null); // Clear previous status
    setResult(null); // Clear execution results
    setError(null); // Clear execution errors

    if (!targetClassName.trim()) {
        setSaveStatus("Error: Please enter a Class Name to save the method to.");
        setIsSaving(false);
        return;
    }

    let parsedCode: SonValue;
    try {
        // 1. Parse the code from the editor
        parsedCode = JSON.parse(code);

        // 2. Validate the structure: must be ["define:args:body:", selector, args, body]
        if (!Array.isArray(parsedCode) || parsedCode.length !== 4 || parsedCode[0] !== 'define:args:body:') {
            throw new Error("Invalid structure: Code must be a SON method definition array like ['define:args:body:', 'selector', ['args'], [body...]].");
        }

        const selector = parsedCode[1];
        const argsNode = parsedCode[2];
        const body = parsedCode[3]; // Body can be any SonValue (usually an array)

        // Further validation
        if (typeof selector !== 'string') {
            throw new Error("Invalid structure: Selector (second element) must be a string.");
        }
        if (!Array.isArray(argsNode)) {
            throw new Error("Invalid structure: Arguments (third element) must be an array.");
        }

        // Validate argument names are strings
        const args = argsNode.map(arg => {
            if (typeof arg !== 'string') {
                throw new Error(`Invalid structure: Argument name '${JSON.stringify(arg)}' is not a string.`);
            }
            return arg;
        });

        // 3. Call the API Client
        console.log(`Saving method "${selector}" to class "${targetClassName}"...`);
        const payload = {
            className: targetClassName.trim(),
            selector: selector,
            arguments: args,
            body: body, // Send the body as is
        };
        const response = await apiSaveMethod(payload);

        // 4. Set success status
        setSaveStatus(`Success: Method '${selector}' saved to class '${targetClassName}'. Refresh required to see changes.`);
        console.log("Save successful:", response);

    } catch (e: any) {
        // Handle parsing errors, validation errors, or API errors
        console.error("Save Method Error:", e);
        if (e instanceof SyntaxError) {
            setSaveStatus(`Save Error: Invalid JSON - ${e.message}`);
        } else if (e instanceof Error) {
            // Includes validation errors and API client errors
            setSaveStatus(`Save Error: ${e.message}`);
        } else {
            setSaveStatus(`Save Error: An unexpected error occurred: ${String(e)}`);
        }
    } finally {
        setIsSaving(false); // Re-enable button
    }
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
                backgroundColor: 'var(--editor-bg, #ffffff)', // Use CSS variable or default
                color: 'var(--editor-fg, #333333)', // Use CSS variable or default
                minHeight: '100%',
              }}
            />
        </div>
      </Panel>

       {/* Controls Area: Buttons + Class Name Input */}
      <div className="flex-shrink-0 flex flex-wrap items-center space-x-2">
         {/* Buttons */}
         <Button onClick={handleExecute} disabled={isEnvLoading}>
            {isEnvLoading ? 'Loading Env...' : 'Execute'}
         </Button>
         <Button onClick={handleSave} disabled={isEnvLoading || isSaving}>
             {isSaving ? 'Saving...' : 'Save Method'}
         </Button>

         {/* Class Name Input for Saving */}
         <div className="flex items-center space-x-1">
             <label htmlFor="classNameInput" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                 Class Name:
             </label>
             <input
                 type="text"
                 id="classNameInput"
                 value={targetClassName}
                 onChange={(e: ChangeEvent<HTMLInputElement>) => setTargetClassName(e.target.value)}
                 placeholder="Enter class to save to"
                 className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                 disabled={isSaving} // Disable input while saving
             />
         </div>
      </div>

      {/* Save Status Display */}
      {saveStatus && (
          <div className={`flex-shrink-0 p-2 text-sm rounded-md ${saveStatus.startsWith('Error:') || saveStatus.startsWith('Save Error:') ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'}`}>
              {saveStatus}
          </div>
      )}


      {/* Results Panel - Updated to display result or error */}
      <Panel title="Result" className="flex-shrink-0 h-1/6 overflow-y-auto">
        {/* Use ConsoleOutput styling for consistency, or define specific result styles */}
        <div className="h-full overflow-y-auto bg-gray-100 dark:bg-gray-800 p-2 rounded">
           <pre className="text-sm whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
             {error ? (
               <span className="text-red-600 dark:text-red-400">{error}</span>
             ) : result !== null ? (
               <span>{result}</span> // Result already formatted
             ) : (
               <span className="text-gray-400 dark:text-gray-500 italic">Execution results will appear here...</span>
             )}
           </pre>
        </div>
      </Panel>

      {/* Console Output Panel - Render the ConsoleOutput component */}
      <Panel title="Console" className="flex-shrink-0 h-1/6 overflow-y-auto">
         <ConsoleOutput messages={consoleOutput} className="h-full" />
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
      --editor-bg: #1f2937; /* Tailwind gray-800 */
      --editor-fg: #f3f4f6; /* Tailwind gray-100 */
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

// Ensure Prism JSON highlighting is loaded (if not using auto-loader)
if (typeof window !== 'undefined' && !languages.json) {
    require('prismjs/components/prism-json');
}