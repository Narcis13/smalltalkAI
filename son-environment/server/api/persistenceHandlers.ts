/**
 * @file server/api/persistenceHandlers.ts
 * @description API request handlers related to SON class and method persistence.
 * Provides functions to fetch class/method data and save new/updated methods.
 * 
 * Key features:
 * - Fetches list of all class names.
 * - Fetches list of method selectors for a specific class.
 * - Fetches the source code (arguments, body) for a specific method.
 * - Saves or updates a method definition, creating the class if it doesn't exist.
 * 
 * @dependencies
 * - bun:sqlite: Database type definitions.
 * - node:crypto: For generating UUIDs.
 * - ../db: The database instance.
 * 
 * @notes
 * - Handles fetching class lists, method lists for a class, and source code for specific methods.
 * - Handles saving/updating methods via POST request.
 * - Includes error handling for not found resources (404), bad requests (400), and server errors (500).
 * - Uses transactions for database write operations to ensure atomicity.
 */

import type { Database, Statement } from "bun:sqlite";
import { randomUUID } from "node:crypto"; // Import randomUUID for generating IDs

// Types for method source response and save payload
type SonValue = any; // Replace with more specific types if available from client later

interface MethodSourceResponse {
	selector: string;
	arguments: SonValue[];
	body: SonValue[];
}

interface SaveMethodPayload {
	className: string;
	selector: string;
	arguments: SonValue[]; // Expected to be an array
	body: SonValue[];     // Expected to be an array
}

/**
 * Handles GET /api/classes requests.
 * Fetches a list of all class names from the son_classes table.
 *
 * @param db The Bun SQLite database instance.
 * @returns A Promise resolving to a Response object.
 *          - 200 OK: With JSON body {"classes": ["ClassName1", ...]}
 *          - 500 Internal Server Error: If the database query fails.
 */
export async function getClasses(db: Database): Promise<Response> {
	console.log("Handling GET /api/classes");
	try {
		const query = db.query("SELECT name FROM son_classes ORDER BY name;");
		const results = query.all() as { name: string }[];
		const classNames = results.map(row => row.name);

		return new Response(JSON.stringify({ classes: classNames }), {
			headers: { "Content-Type": "application/json" },
			status: 200,
		});
	} catch (error: any) {
		console.error("Error fetching classes:", error);
		return new Response(JSON.stringify({ error: "Failed to fetch classes", details: error.message }), {
			headers: { "Content-Type": "application/json" },
			status: 500,
		});
	}
}

/**
 * Handles GET /api/methods/{className} requests.
 * Fetches a list of method selectors for a given class name.
 *
 * @param db The Bun SQLite database instance.
 * @param className The name of the class to fetch methods for.
 * @returns A Promise resolving to a Response object.
 *          - 200 OK: With JSON body {"methods": ["selector1", ...]}
 *          - 404 Not Found: If the specified class name does not exist.
 *          - 500 Internal Server Error: If the database query fails.
 */
export async function getMethods(db: Database, className: string): Promise<Response> {
	console.log(`Handling GET /api/methods/${className}`);
	try {
		// First, check if the class exists
		const classQuery = db.query("SELECT id FROM son_classes WHERE name = ?;");
		const classResult = classQuery.get(className) as { id: string } | null;

		if (!classResult) {
			return new Response(JSON.stringify({ error: `Class not found: ${className}` }), {
				headers: { "Content-Type": "application/json" },
				status: 404,
			});
		}

		const classId = classResult.id;

		// Fetch method selectors for the class
		const methodsQuery = db.query("SELECT selector FROM son_methods WHERE class_id = ? ORDER BY selector;");
		const methodsResults = methodsQuery.all(classId) as { selector: string }[];
		const methodSelectors = methodsResults.map(row => row.selector);

		return new Response(JSON.stringify({ methods: methodSelectors }), {
			headers: { "Content-Type": "application/json" },
			status: 200,
		});

	} catch (error: any) {
		console.error(`Error fetching methods for class "${className}":`, error);
		return new Response(JSON.stringify({ error: "Failed to fetch methods", details: error.message }), {
			headers: { "Content-Type": "application/json" },
			status: 500,
		});
	}
}

/**
 * Handles GET /api/method/{className}/{selector} requests.
 * Fetches the source code (arguments and body JSON) for a specific method of a class.
 *
 * @param db The Bun SQLite database instance.
 * @param className The name of the class.
 * @param selector The method selector.
 * @returns A Promise resolving to a Response object.
 *          - 200 OK: With JSON body {"selector": "...", "arguments": [...], "body": [...]}
 *          - 404 Not Found: If the class or method does not exist.
 *          - 500 Internal Server Error: If the database query or JSON parsing fails.
 */
export async function getMethodSource(db: Database, className: string, selector: string): Promise<Response> {
	console.log(`Handling GET /api/method/${className}/${selector}`);
	try {
		const query = db.query(`
      SELECT m.selector, m.arguments_json, m.body_json
      FROM son_methods m
      JOIN son_classes c ON m.class_id = c.id
      WHERE c.name = ? AND m.selector = ?;
    `);
		const result = query.get(className, selector) as { selector: string; arguments_json: string; body_json: string } | null;

		if (!result) {
			// Check if the class exists at all to give a more specific error
			const classQuery = db.query("SELECT id FROM son_classes WHERE name = ?;");
			const classExists = classQuery.get(className);
			if (!classExists) {
				return new Response(JSON.stringify({ error: `Class not found: ${className}` }), {
					headers: { "Content-Type": "application/json" },
					status: 404,
				});
			} else {
				return new Response(JSON.stringify({ error: `Method not found: ${selector} in class ${className}` }), {
					headers: { "Content-Type": "application/json" },
					status: 404,
				});
			}
		}

		// Parse the JSON strings for arguments and body
		let args: SonValue[];
		let body: SonValue[];
		try {
			args = JSON.parse(result.arguments_json);
		} catch (e: any) {
			throw new Error(`Invalid arguments JSON in database for ${className}>>${selector}: ${e.message}`);
		}
		try {
			body = JSON.parse(result.body_json);
		} catch (e: any) {
			throw new Error(`Invalid body JSON in database for ${className}>>${selector}: ${e.message}`);
		}


		const responsePayload: MethodSourceResponse = {
			selector: result.selector,
			arguments: args,
			body: body,
		};

		return new Response(JSON.stringify(responsePayload), {
			headers: { "Content-Type": "application/json" },
			status: 200,
		});

	} catch (error: any) {
		console.error(`Error fetching method source for "${className} >> ${selector}":`, error);
		// Differentiate between JSON parse error (likely 500) and others
		const status = error.message.includes("Invalid") ? 500 : 500; // Default to 500
		return new Response(JSON.stringify({ error: "Failed to fetch method source", details: error.message }), {
			headers: { "Content-Type": "application/json" },
			status: status,
		});
	}
}

/**
 * Handles POST /api/method requests.
 * Saves or updates a method definition in the database. Creates the class if it doesn't exist.
 * Expects a JSON body conforming to SaveMethodPayload.
 *
 * @param db The Bun SQLite database instance.
 * @param data The parsed JSON payload from the request body.
 * @returns A Promise resolving to a Response object.
 *          - 201 Created: If a new method was created.
 *          - 200 OK: If an existing method was updated.
 *          - 400 Bad Request: If the input data is invalid (missing fields, wrong types, invalid JSON strings).
 *          - 500 Internal Server Error: If the database operation fails.
 */
export async function saveMethod(db: Database, data: any): Promise<Response> {
	console.log(`Handling POST /api/method with payload:`, JSON.stringify(data));

	// --- Input Validation ---
	if (!data || typeof data !== 'object') {
		return new Response(JSON.stringify({ error: "Invalid request body: Expected JSON object." }), { status: 400, headers: { "Content-Type": "application/json" } });
	}

	const { className, selector, arguments: args, body } = data as Partial<SaveMethodPayload>;

	if (typeof className !== 'string' || !className.trim()) {
		return new Response(JSON.stringify({ error: "Invalid request body: 'className' must be a non-empty string." }), { status: 400, headers: { "Content-Type": "application/json" } });
	}
	if (typeof selector !== 'string' || !selector.trim()) {
		return new Response(JSON.stringify({ error: "Invalid request body: 'selector' must be a non-empty string." }), { status: 400, headers: { "Content-Type": "application/json" } });
	}
	if (!Array.isArray(args)) {
		return new Response(JSON.stringify({ error: "Invalid request body: 'arguments' must be an array." }), { status: 400, headers: { "Content-Type": "application/json" } });
	}
	if (!Array.isArray(body)) {
		return new Response(JSON.stringify({ error: "Invalid request body: 'body' must be an array." }), { status: 400, headers: { "Content-Type": "application/json" } });
	}

	let argsJsonString: string;
	let bodyJsonString: string;
	try {
		argsJsonString = JSON.stringify(args);
		bodyJsonString = JSON.stringify(body);
	} catch (e: any) {
		console.error("Error stringifying arguments/body JSON:", e);
		return new Response(JSON.stringify({ error: "Invalid request body: Could not serialize 'arguments' or 'body' to JSON.", details: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
	}

	// --- Database Operation (Transaction) ---
	try {
		// Prepare statements within the transaction function for efficiency if called repeatedly,
		// but for a single handler, defining them here is fine.
		const insertClassStmt = db.prepare("INSERT INTO son_classes (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING;");
		const selectClassIdStmt = db.prepare("SELECT id FROM son_classes WHERE name = ?;");
		const upsertMethodStmt = db.prepare(`
      INSERT INTO son_methods (id, class_id, selector, arguments_json, body_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(class_id, selector) DO UPDATE SET
        arguments_json = excluded.arguments_json,
        body_json = excluded.body_json;
    `);

        // Wrap operations in a transaction
		const runTransaction = db.transaction(() => {
			// 1. Ensure class exists and get its ID
			const classUUID = randomUUID();
			insertClassStmt.run(classUUID, className.trim()); // Trim whitespace

			const classResult = selectClassIdStmt.get(className.trim()) as { id: string } | null;
			if (!classResult) {
				// This should ideally not happen if INSERT worked, but defensively check.
				throw new Error(`Failed to find or create class: ${className.trim()}`);
			}
			const classId = classResult.id;

			// 2. Insert or Update the method
            // Need to check if it was an insert or update to return correct status
            const checkExistingStmt = db.prepare("SELECT id FROM son_methods WHERE class_id = ? AND selector = ?");
            const existingMethod = checkExistingStmt.get(classId, selector.trim());

			const methodUUID = randomUUID();
			upsertMethodStmt.run(methodUUID, classId, selector.trim(), argsJsonString, bodyJsonString);

            return { wasInsert: !existingMethod }; // Return whether it was a new method
		});

        // Execute the transaction
		const { wasInsert } = runTransaction();

        // Determine status code based on whether a new method was created
		const status = wasInsert ? 201 : 200;
        const message = wasInsert ? "Method created successfully" : "Method updated successfully";

		console.log(`${message} for ${className.trim()}>>${selector.trim()}`);
		return new Response(JSON.stringify({ message }), {
			status: status,
			headers: { "Content-Type": "application/json" },
		});

	} catch (error: any) {
		console.error(`Error saving method "${className.trim()} >> ${selector.trim()}":`, error);
		return new Response(JSON.stringify({ error: "Failed to save method to database", details: error.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}