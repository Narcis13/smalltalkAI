/**
 * @file server/api/environmentHandlers.ts
 * @description API request handlers related to the SON base environment.
 *
 * @dependencies
 * - bun:sqlite: Database type definitions.
 * - ../db: The database instance.
 *
 * @notes
 * - Handles fetching and formatting the base environment definitions stored in the database.
 */

import type { Database } from "bun:sqlite";

/**
 * Handles GET /api/base-environment requests.
 * Fetches all entries from the son_base_environment table, parses the JSON values,
 * and returns them as a single merged JSON object.
 *
 * @param db The Bun SQLite database instance.
 * @returns A Promise resolving to a Response object.
 *          - 200 OK: With JSON body containing the merged base environment.
 *          - 500 Internal Server Error: If database query or JSON parsing fails.
 */
export async function getBaseEnvironment(db: Database): Promise<Response> {
	console.log("Handling GET /api/base-environment");
	try {
		const query = db.query("SELECT key, value_json FROM son_base_environment;");
		const results = query.all() as { key: string; value_json: string }[];

		const baseEnvironment = results.reduce((acc, row) => {
			try {
				acc[row.key] = JSON.parse(row.value_json);
			} catch (parseError) {
				console.error(`Failed to parse JSON for base environment key "${row.key}":`, parseError);
				// Decide how to handle parse errors: skip the key, throw, return error response?
				// For now, we'll throw to indicate a server configuration issue.
				throw new Error(`Invalid JSON in database for key: ${row.key}`);
			}
			return acc;
		}, {} as Record<string, any>);

		return new Response(JSON.stringify(baseEnvironment), {
			headers: { "Content-Type": "application/json" },
			status: 200,
		});
	} catch (error: any) {
		console.error("Error fetching base environment:", error);
		return new Response(JSON.stringify({ error: "Failed to fetch base environment", details: error.message }), {
			headers: { "Content-Type": "application/json" },
			status: 500,
		});
	}
}