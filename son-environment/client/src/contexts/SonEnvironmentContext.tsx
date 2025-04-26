/**
 * <ai_info>
 * This file defines the React Context and Provider for managing the global SON execution environment ($env).
 * It handles initializing the environment, fetching the base definitions from the backend API,
 * and providing the environment instance, loading state, error state, and a reload function to consuming components.
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
 * - Merges fetched base environment data into the root `SonEnvironment` instance.
 *
 * @dependencies
 * - react: Core React hooks (`createContext`, `useContext`, `useState`, `useEffect`, `useCallback`).
 * - ../lib/apiClient: Function to fetch the base environment (`getBaseEnvironment`) and related types.
 * - ../lib/son/environment: The `SonEnvironment` class implementing `ISonEnvironment`.
 * - ../lib/son/types: Core SON types (`ISonEnvironment`, `SonValue`).
 *
 * @notes
 * - The initial `environment` state is null until the base environment is loaded.
 * - Error handling during fetching is included.
 * - The merging strategy for the base environment is currently a simple property assignment; this might need refinement based on the structure of the base environment data.
 */
"use client"; // Required for context and hooks

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	ReactNode,
} from "react";
import { getBaseEnvironment, BaseEnvironmentResponse, SonValue } from "@/lib/apiClient";
import { SonEnvironment } from "@/lib/son/environment";
import { ISonEnvironment } from "@/lib/son/types";

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
 * Currently performs a shallow merge, assigning top-level keys from the fetched
 * data directly onto the environment's internal storage.
 *
 * @param env The SonEnvironment instance to merge into.
 * @param baseData The fetched base environment data.
 */
const mergeBaseEnvironment = (env: ISonEnvironment, baseData: BaseEnvironmentResponse) => {
    console.log("Merging base environment data:", baseData);
    // Simple shallow merge: Assign each top-level key from baseData to the environment.
    // This assumes baseData is a flat object where keys are variable names
    // and values are the corresponding SonValue to store.
    // More complex merging might be needed if baseData contains nested structures
    // or requires specific instantiation logic.
    for (const key in baseData) {
        if (Object.prototype.hasOwnProperty.call(baseData, key)) {
            // Directly set the value in the environment's root scope.
            // TODO: Consider if values need transformation or special handling (e.g., creating class instances).
            env.set(key, baseData[key] as SonValue);
        }
    }
    console.log("Environment after merge:", env); // Check the state after merge
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
            // For now, the root environment has no parent.
			const rootEnv = new SonEnvironment(null);

			// Merge the fetched data into the root environment
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
	}, [loadBaseEnvironment]); // Run effect when loadBaseEnvironment function identity changes (should be stable)


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
