/**
 * <ai_info>
 * This file defines the React Context and Provider for managing the global SON execution environment ($env).
 * It handles initializing the environment, fetching the base definitions from the backend API,
 * and providing the environment instance, loading state, error state, and a reload function to consuming components.
 * The `mergeBaseEnvironment` function is designed to handle base environment data where keys
 * are class names and values are objects potentially containing method definitions. It creates
 * `SonEnvironment` instances for these class definitions to enable method lookup. It also
 * specifically handles the `JSBridge` object by attaching actual JS functions.
 * </ai_info>
 *
 * @file client/src/contexts/SonEnvironmentContext.tsx
 * @description React Context for managing the SON execution environment ($env).
 *
 * Key features:
 * - Creates a React Context (`SonEnvironmentContext`).
 * - Defines the `SonEnvironmentProvider` component.
 * - Manages the `ISonEnvironment` instance using `useState`.
 * - Fetches the base environment from the API (`apiClient.getBaseEnvironment`) on mount using `useEffect`.
 * - Handles loading and error states during the fetch process.
 * - Provides a `reloadEnvironment` function to refetch the base environment.
 * - Merges fetched base environment data into the root `SonEnvironment` instance, creating
 *   `SonEnvironment` instances for class definitions found in the base data.
 * - Creates a special JS object for `JSBridge` and attaches real JS functions to it.
 *
 * @dependencies
 * - react: Core React hooks (`createContext`, `useState`, `useEffect`, `useCallback`, `ReactNode`).
 * - ../lib/apiClient: Function to fetch the base environment (`getBaseEnvironment`) and related types.
 * - ../lib/son/environment: The `SonEnvironment` class implementing `ISonEnvironment`.
 * - ../lib/son/types: Core SON types (`ISonEnvironment`, `SonValue`, `SonMethodImplementation`, `SonBlock`).
 * - ../lib/son/interpreter: `evaluate` function needed for `setTimeout` callback.
 *
 * @notes
 * - The initial `environment` state is null until the base environment is loaded.
 * - Error handling during fetching is included.
 * - `mergeBaseEnvironment` attempts to instantiate `SonEnvironment` for base classes,
 *   assuming a structure like `{"ClassName": {"methods": {"selector": {...}}}}`.
 * - `JSBridge` is handled specially to link to actual browser/JS capabilities.
 */
"use client"; // Required for context and hooks

import React, {
	createContext,
	useState,
	useEffect,
	useCallback,
	ReactNode,
} from "react";
import { getBaseEnvironment, BaseEnvironmentResponse, SonValue } from "@/lib/apiClient";
import { SonEnvironment } from "@/lib/son/environment";
import { ISonEnvironment, SonMethodImplementation, SonBlock } from "@/lib/son/types"; // Import SonMethodImplementation, SonBlock
import { evaluate } from "@/lib/son/interpreter"; // Needed for setTimeout callback evaluation
import { SonError } from "@/lib/son/errors"; // Import SonError

/**
 * Defines the shape of the value provided by the SonEnvironmentContext.
 */
interface SonEnvironmentContextType {
	/** The root SON execution environment instance, or null if not yet loaded/initialized. */
	environment: ISonEnvironment | null;
	/** Indicates if the base environment is currently being loaded. */
	isLoading: boolean;
	/** Stores any error message that occurred during environment loading. */
	error: string | null;
	/** Function to trigger a reload of the base environment from the API. */
	reloadEnvironment: () => void;
}

/**
 * React Context object for the SON environment.
 */
const SonEnvironmentContext = createContext<SonEnvironmentContextType | undefined>(
	undefined
);

/**
 * Props for the SonEnvironmentProvider component.
 */
interface SonEnvironmentProviderProps {
	children: ReactNode;
}

/**
 * Merges the fetched base environment data into a SonEnvironment instance.
 * It iterates through the top-level keys of the base data.
 * - Handles `JSBridge` specifically by creating a JS object with real functions.
 * - If a value looks like a class definition (e.g., an object with a 'methods' property), it
 *   creates a new SonEnvironment instance for it and defines its methods.
 * - Otherwise, it sets the value directly.
 *
 * @param env The root SonEnvironment instance to merge into.
 * @param baseData The fetched base environment data (key-value map).
 */
const mergeBaseEnvironment = (env: ISonEnvironment, baseData: BaseEnvironmentResponse) => {
    console.log("Merging base environment data:", baseData);

    for (const key in baseData) {
        if (Object.prototype.hasOwnProperty.call(baseData, key)) {
            const value = baseData[key];

            // --- Special Handling for JSBridge ---
            if (key === 'JSBridge' && typeof value === 'object' && value !== null && (value as any).__isJSBridge === true) {
                console.log("Detected JSBridge definition. Creating special bridge object...");
                const jsBridgeObject = {
                    __isJSBridge: true, // Mark this object for the interpreter
                    // Add actual JS implementation functions here
                    'log:': (message: SonValue) => {
                        // Convert SON value to string/readable format for console
                        console.log('[SON Log]', String(message)); // Prefix logs from SON
                        return jsBridgeObject; // Return self (bridge object) for chaining/consistency
                    },
                    'setTimeout:delay:': (block: SonValue, delayMs: SonValue) => {
                        if (typeof block !== 'object' || block === null || (block as any).__type !== 'SonBlock') {
                             // Throwing error here might be harsh, could return null/error object in SON?
                             console.error("JSBridge Error: setTimeout: expects a BlockClosure as the first argument.");
                             throw new Error("setTimeout: first argument must be a BlockClosure");
                             // return null;
                        }
                        if (typeof delayMs !== 'number' || !Number.isInteger(delayMs) || delayMs < 0) {
                            console.error("JSBridge Error: setTimeout: expects a non-negative integer delay (ms) as the second argument.");
                            throw new Error("setTimeout: second argument must be a non-negative integer delay (ms)");
                            // return null;
                        }

                        const sonBlock = block as SonBlock;
                        console.log(`JSBridge: Scheduling block execution in ${delayMs}ms`);

                        setTimeout(() => {
                             console.log(`JSBridge: Executing scheduled block after ${delayMs}ms delay.`);
                             // Evaluate the block's body in its captured lexical scope
                             // Note: This evaluation happens asynchronously. Errors need careful handling.
                             try {
                                // Blocks evaluate as sequences, result is the last statement's value
                                 let blockResult: SonValue = null; // Default result if body is empty
                                 if(Array.isArray(sonBlock.body)) {
                                    for (let i = 0; i < sonBlock.body.length; i++) {
                                        // Use the block's *captured* lexical scope, NOT the global env
                                        blockResult = evaluate(sonBlock.body[i], sonBlock.lexicalScope);
                                    }
                                 } else {
                                     console.error("Scheduled block execution failed: Invalid block body structure.");
                                     // How to report this async error back to SON? Difficult.
                                 }
                                 console.log(`JSBridge: Scheduled block finished execution. Result (unused):`, blockResult);
                             } catch (e) {
                                 // Catch errors during async block execution. Cannot easily throw back into SON.
                                 console.error("Error during scheduled block execution:", e);
                                 if (e instanceof LocalReturnError || e instanceof NonLocalReturnError) {
                                     console.error("Error: Cannot perform return (^) from asynchronously executed block via setTimeout.");
                                 }
                                 // Potential: Use WebSocket or another mechanism to report async errors to the UI?
                             }
                        }, delayMs);

                        return jsBridgeObject; // setTimeout returns self
                    },
                    // Add placeholder for fetch, implementation deferred
                    'fetch:options:': (url: SonValue, options: SonValue) => {
                        console.warn("JSBridge fetch:options: is not implemented yet.");
                        // For now, return null or throw a SON error?
                         // throw new SonError("JSBridge fetch:options: is not implemented.");
                        return null;
                    }
                    // Add more JS bridge methods as needed
                };
                // Store the functional JS object in the environment
                env.set(key, jsBridgeObject);
                continue; // Skip other merging logic for JSBridge
            }

            // --- Heuristic for Class Definitions ---
            // Check if the value is an object containing a 'methods' property which is also an object.
             let isClassDefinition = false;
             if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                 const potentialClass = value as any;
                 if (potentialClass.hasOwnProperty('methods') && typeof potentialClass.methods === 'object' && potentialClass.methods !== null) {
                     isClassDefinition = true;
                 }
             }


            if (isClassDefinition) {
                console.log(`Detected class definition for '${key}'. Creating SonEnvironment...`);
                // Create a new environment for the class.
                // Base classes typically don't inherit from anything in this model,
                // inheritance is handled via lookup chain (e.g., checking Object if method not found).
                // For simplicity, their parent is null.
                const classEnv = new SonEnvironment(null);

                // Add methods from the definition to the class environment
                const methods = (value as any).methods as Record<string, any>;
                for (const selector in methods) {
                    if (Object.prototype.hasOwnProperty.call(methods, selector)) {
                        const methodData = methods[selector];
                        // Validate method structure before defining
                        if (typeof methodData === 'object' && methodData !== null && Array.isArray(methodData.argNames) && methodData.body !== undefined) {
                             const argNames = methodData.argNames.map(String); // Ensure strings
                             classEnv.defineMethod(selector, argNames, methodData.body as SonValue);
                             // console.log(` -> Defined method #${selector} for class ${key}`);
                        } else {
                             console.warn(`Invalid method structure for ${key}>>${selector}. Skipping.`);
                        }
                    }
                }
                // Store the created class environment under the class name in the root environment
                env.set(key, classEnv);

            } else {
                // If it doesn't look like a class or JSBridge, store the value directly
                console.log(`Setting base value for '${key}' (not detected as class/JSBridge).`);
                env.set(key, value as SonValue);
            }
        }
    }
    console.log("Environment state after merge:");
    // Use console.dir for better object inspection if dumpScope isn't available/sufficient
    console.dir(env);
    if (env instanceof SonEnvironment && env.dumpScope) {
         console.log(env.dumpScope(1)); // Dump root and one level down
    }
};


/**
 * Provides the SON execution environment state to its children components.
 * Fetches the base environment on initial mount.
 *
 * @param {SonEnvironmentProviderProps} props - The component props.
 * @returns {JSX.Element} The provider component wrapping its children.
 */
export function SonEnvironmentProvider({ children }: SonEnvironmentProviderProps): JSX.Element {
	const [environment, setEnvironment] = useState<ISonEnvironment | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
	const [error, setError] = useState<string | null>(null);

	/**
	 * Loads the base environment from the backend API and initializes the environment state.
	 * Uses `useCallback` to memoize the function for stability.
	 */
	const loadBaseEnvironment = useCallback(async () => {
		console.log("Attempting to load base environment...");
		setIsLoading(true);
		setError(null);
		setEnvironment(null); // Reset environment while loading

		try {
			// Fetch the base environment JSON object from the API
			const baseEnvData = await getBaseEnvironment();

			// Create the root environment instance
            // The root environment has no parent.
			const rootEnv = new SonEnvironment(null);

			// Merge the fetched data into the root environment
            // This function now handles classes and the JSBridge specifically
			mergeBaseEnvironment(rootEnv, baseEnvData);

			// Set the initialized environment state
			setEnvironment(rootEnv);
			console.log("Base environment loaded and set successfully.");

		} catch (err: any) {
			console.error("Failed to load base environment:", err);
			setError(err.message || "An unknown error occurred while loading the environment.");
            setEnvironment(null); // Ensure environment is null on error
		} finally {
			setIsLoading(false);
            console.log("Finished loading base environment (success or failure).");
		}
	}, []); // No dependencies, should only run once unless explicitly called by reload

	/**
	 * Reloads the base environment by calling `loadBaseEnvironment`.
	 */
	const reloadEnvironment = useCallback(() => {
        console.log("Reload environment triggered.");
		loadBaseEnvironment();
	}, [loadBaseEnvironment]); // Depends on the memoized load function

	// Load the base environment when the provider mounts
	useEffect(() => {
        console.log("SonEnvironmentProvider mounted, initiating base environment load.");
		loadBaseEnvironment();
        // eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Run only once on mount


	// Prepare the context value
	const contextValue: SonEnvironmentContextType = {
		environment,
		isLoading,
		error,
		reloadEnvironment,
	};

	return (
		<SonEnvironmentContext.Provider value={contextValue}>
			{children}
		</SonEnvironmentContext.Provider>
	);
}

export { SonEnvironmentContext }; // Export context for direct use if needed