/**
 * <ai_info>
 * This file defines a client-side service for interacting with the SON Environment backend API.
 * It provides typed functions for fetching data (base environment, classes, methods, method source)
 * and for persisting data (saving methods). It uses the native `fetch` API and includes
 * error handling for network issues and non-successful API responses.
 * </ai_info>
 *
 * @file client/src/lib/apiClient.ts
 * @description Typed wrappers for fetching data from the BunJS backend API.
 *
 * Key features:
 * - Provides async functions for all defined backend API endpoints.
 * - Uses TypeScript types for request payloads and response data.
 * - Handles basic network and HTTP error conditions.
 * - Centralizes API communication logic.
 *
 * @dependencies
 * - None (uses native `fetch` API)
 *
 * @notes
 * - Assumes the backend server is running at `http://localhost:3013`.
 * - Error handling throws standard `Error` objects; callers should use try/catch.
 * - More specific SON types can replace `any` in `SonValue` later if needed.
 */

// Define the base URL for the backend API
// Ensure the backend server (running on Bun) is accessible at this address.
// TODO: Potentially make this configurable via environment variables?
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3013";

/**
 * Represents any valid SON JSON value.
 * TODO: Define more specific types for SON structures (arrays, objects with '#', etc.) later.
 */
export type SonValue = any;

/**
 * Expected structure of the response from GET /api/base-environment.
 * A key-value map representing the core objects and classes.
 */
export type BaseEnvironmentResponse = Record<string, SonValue>;

/**
 * Expected structure of the response from GET /api/classes.
 */
export interface ClassListResponse {
	classes: string[];
}

/**
 * Expected structure of the response from GET /api/methods/{className}.
 */
export interface MethodListResponse {
	methods: string[];
}

/**
 * Expected structure of the response from GET /api/method/{className}/{selector}.
 */
export interface MethodSourceResponse {
	selector: string;
	arguments: SonValue[];
	body: SonValue[];
}

/**
 * Structure of the payload for POST /api/method.
 */
export interface SaveMethodPayload {
	className: string;
	selector: string;
	arguments: SonValue[];
	body: SonValue[];
}

/**
 * Expected structure of the success response from POST /api/method.
 */
export interface SaveMethodResponse {
	message: string;
}

/**
 * Expected structure of error responses from the API.
 */
export interface ApiErrorResponse {
	error: string;
	details?: string;
}

/**
 * Helper function to handle fetch responses and errors.
 * Checks if the response is OK, otherwise tries to parse error JSON and throws.
 *
 * @param response - The Response object from fetch.
 * @param context - A string describing the operation for error messages.
 * @returns The parsed JSON body as T.
 * @throws {Error} If the fetch response is not OK or if JSON parsing fails.
 */
async function handleApiResponse<T>(response: Response, context: string): Promise<T> {
	if (response.ok) {
		// Handle potential empty body for 201/204 statuses if necessary
        if (response.status === 204) {
            // If No Content is expected and valid, return an empty object or null
            // Adjust based on expected behavior for specific endpoints
             return {} as T; // Or null, or handle specifically in callers
        }
		try {
			return (await response.json()) as T;
		} catch (error) {
			console.error(`Error parsing JSON response for ${context}:`, error);
			throw new Error(`Failed to parse JSON response for ${context}. Status: ${response.status}`);
		}
	} else {
		// Try to parse the error body
		let errorDetails = `Status: ${response.status} ${response.statusText}`;
		try {
			const errorResponse = (await response.json()) as ApiErrorResponse;
			if (errorResponse.error) {
				errorDetails += ` - ${errorResponse.error}`;
				if (errorResponse.details) {
					errorDetails += `: ${errorResponse.details}`;
				}
			}
		} catch (e) {
			// Ignore error - couldn't parse error body, stick with status text
			console.warn(`Could not parse error response body for ${context}. Status: ${response.status}`);
		}
		throw new Error(`API Error during ${context}: ${errorDetails}`);
	}
}

/**
 * Fetches the base SON environment definitions from the backend.
 * Corresponds to GET /api/base-environment.
 *
 * @returns A Promise resolving to the base environment object.
 * @throws {Error} If the fetch fails or the API returns an error.
 */
export async function getBaseEnvironment(): Promise<BaseEnvironmentResponse> {
	const context = "fetching base environment";
	console.log("apiClient: Fetching base environment...");
	try {
		const response = await fetch(`${API_BASE_URL}/api/base-environment`);
		return await handleApiResponse<BaseEnvironmentResponse>(response, context);
	} catch (error) {
		console.error(`Network or API error during ${context}:`, error);
		// Re-throw the error for the caller to handle
		throw error;
	}
}

/**
 * Fetches the list of all defined class names from the backend.
 * Corresponds to GET /api/classes.
 *
 * @returns A Promise resolving to an object containing the list of class names.
 * @throws {Error} If the fetch fails or the API returns an error.
 */
export async function getClasses(): Promise<ClassListResponse> {
	const context = "fetching classes";
	console.log("apiClient: Fetching classes...");
	try {
		const response = await fetch(`${API_BASE_URL}/api/classes`);
		return await handleApiResponse<ClassListResponse>(response, context);
	} catch (error) {
		console.error(`Network or API error during ${context}:`, error);
		throw error;
	}
}

/**
 * Fetches the list of method selectors for a specific class from the backend.
 * Corresponds to GET /api/methods/{className}.
 *
 * @param className - The name of the class to fetch methods for.
 * @returns A Promise resolving to an object containing the list of method selectors.
 * @throws {Error} If the fetch fails, the class is not found (404), or the API returns an error.
 */
export async function getMethods(className: string): Promise<MethodListResponse> {
	const context = `fetching methods for class "${className}"`;
	console.log(`apiClient: ${context}...`);
	if (!className) {
		// Prevent request with empty class name
		console.warn("apiClient: getMethods called with empty className, returning empty list.");
        return { methods: [] }; // Or throw an error? Returning empty seems safer for UI.
	}
	try {
		const encodedClassName = encodeURIComponent(className);
		const response = await fetch(`${API_BASE_URL}/api/methods/${encodedClassName}`);
		return await handleApiResponse<MethodListResponse>(response, context);
	} catch (error) {
		console.error(`Network or API error during ${context}:`, error);
		throw error;
	}
}

/**
 * Fetches the SON source code (arguments, body) for a specific method.
 * Corresponds to GET /api/method/{className}/{selector}.
 *
 * @param className - The name of the class containing the method.
 * @param selector - The selector of the method to fetch.
 * @returns A Promise resolving to the method's source code structure.
 * @throws {Error} If the fetch fails, the class/method is not found (404), or the API returns an error.
 */
export async function getMethodSource(className: string, selector: string): Promise<MethodSourceResponse> {
	const context = `fetching method source for "${className} >> ${selector}"`;
	console.log(`apiClient: ${context}...`);
    if (!className || !selector) {
        console.error(`apiClient: getMethodSource called with empty className or selector.`);
        throw new Error("className and selector cannot be empty when fetching method source.");
    }
	try {
		const encodedClassName = encodeURIComponent(className);
		const encodedSelector = encodeURIComponent(selector); // Ensure selector is URL-safe
		const response = await fetch(`${API_BASE_URL}/api/method/${encodedClassName}/${encodedSelector}`);
		return await handleApiResponse<MethodSourceResponse>(response, context);
	} catch (error) {
		console.error(`Network or API error during ${context}:`, error);
		throw error;
	}
}

/**
 * Saves or updates a method definition on the backend.
 * Corresponds to POST /api/method.
 *
 * @param payload - An object containing className, selector, arguments (array), and body (array).
 * @returns A Promise resolving to the success message from the backend.
 * @throws {Error} If the fetch fails, validation fails (400), or the API returns an error (500).
 */
export async function saveMethod(payload: SaveMethodPayload): Promise<SaveMethodResponse> {
	const context = `saving method "${payload.className} >> ${payload.selector}"`;
	console.log(`apiClient: ${context}...`);
	try {
		const response = await fetch(`${API_BASE_URL}/api/method`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
        // Use handleApiResponse which checks response.ok
		return await handleApiResponse<SaveMethodResponse>(response, context);
	} catch (error) {
		console.error(`Network or API error during ${context}:`, error);
		throw error;
	}
}

// Example of exporting the entire client as an object (alternative style)
// export const apiClient = {
//   getBaseEnvironment,
//   getClasses,
//   getMethods,
//   getMethodSource,
//   saveMethod,
// };