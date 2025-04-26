/**
 * <ai_info>
 * This file defines a custom React hook `useSonEnvironment` for conveniently accessing
 * the SON environment context (`SonEnvironmentContext`). It simplifies component logic
 * by providing direct access to the context value and includes an error check to ensure
 * it's used within a `SonEnvironmentProvider`.
 * </ai_info>
 *
 * @file client/src/hooks/useSonEnvironment.ts
 * @description Custom hook to access the SonEnvironmentContext.
 *
 * @dependencies
 * - react: `useContext`.
 * - ../contexts/SonEnvironmentContext: The context object to consume.
 *
 * @notes
 * - Provides a cleaner way for components to get the environment state compared to `useContext(SonEnvironmentContext)` directly.
 * - Throws an error if used outside of a `SonEnvironmentProvider`.
 */
"use client"; // Required for hooks

import { useContext } from "react";
import { SonEnvironmentContext } from "@/contexts/SonEnvironmentContext";

/**
 * Custom hook to access the SON environment context.
 * Provides the environment instance, loading state, error state, and reload function.
 *
 * @returns The value provided by `SonEnvironmentContext`.
 * @throws {Error} If the hook is used outside of a `SonEnvironmentProvider`.
 */
export const useSonEnvironment = () => {
	const context = useContext(SonEnvironmentContext);

	if (context === undefined) {
		throw new Error("useSonEnvironment must be used within a SonEnvironmentProvider");
	}

	return context;
};
