/**
 * @file server/server.ts
 * @description Main entry point for the SON Environment BunJS backend server.
 *              Sets up an HTTP server with basic routing and WebSocket support.
 *              Includes routing for API endpoints to handle SON environment persistence.
 * 
 * Key features:
 * - Serves HTTP requests for API endpoints.
 * - Handles WebSocket connections (basic logging).
 * - Implements routing for GET and POST API calls related to SON classes, methods, and base environment.
 * - Includes CORS handling for cross-origin requests from the client.
 * - Uses bun:sqlite database connection managed in db.ts.
 * 
 * @dependencies
 * - bun: Provides the Bun runtime APIs, including Bun.serve and WebSocket types.
 * - ./db: Imports the initialized SQLite database instance.
 * - ./api/environmentHandlers: Handlers for base environment API requests.
 * - ./api/persistenceHandlers: Handlers for class/method persistence API requests (GET and POST).
 * 
 * @notes
 * - This server provides the API endpoints for the Next.js client application.
 * - Routing is handled manually based on the URL pathname and HTTP method.
 * - WebSocket support is included but handlers are minimal (logging only) for MVP.
 * - CORS headers are added to allow requests from the client development server.
 */

import { db } from "./db"; // Import the initialized database instance
import { getBaseEnvironment } from "./api/environmentHandlers";
import { getClasses, getMethods, getMethodSource, saveMethod } from "./api/persistenceHandlers"; // Import saveMethod
import type { ServerWebSocket, WebSocketHandler } from "bun";

const PORT = process.env.PORT ?? 3013; // Use PORT from env or default to 3013
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000"; // Expected client origin

console.log(`Starting SON Environment backend server on port ${PORT}...`);
console.log(`Allowing CORS requests from: ${CLIENT_ORIGIN}`);

// CORS Headers - Adjust origin as needed for production
const corsHeaders = {
	"Access-Control-Allow-Origin": CLIENT_ORIGIN, // Allow requests from the client's origin
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS", // Allowed HTTP methods
	"Access-Control-Allow-Headers": "Content-Type, Authorization", // Allowed headers
	"Access-Control-Allow-Credentials": "true", // If you need to handle credentials/cookies
};


// Define WebSocket behavior (minimal for now)
const wsHandler: WebSocketHandler<{ authToken: string }> = {
	open(ws: ServerWebSocket<{ authToken: string }>) {
		console.log(`WebSocket connection opened: ${ws.remoteAddress}`);
	},
	message(ws: ServerWebSocket<{ authToken: string }>, message: string | BufferSource) {
		console.log(`Received message from ${ws.remoteAddress}:`, message);
		// Example broadcast (not used in MVP core logic):
		// ws.publish("the-lobby", `${ws.data.authToken} says: ${message}`);
	},
	close(ws: ServerWebSocket<{ authToken: string }>, code: number, reason?: string) {
		console.log(`WebSocket connection closed: ${ws.remoteAddress}, Code: ${code}, Reason: ${reason}`);
	},
	drain(ws: ServerWebSocket<{ authToken: string }>) {
		console.log(`WebSocket connection drained: ${ws.remoteAddress}`);
	},
};


// Start the Bun server
const server = Bun.serve<{ authToken: string }>({
	port: PORT,
	/**
	 * Handles incoming HTTP requests.
	 * @param req The incoming request object.
	 * @param server The Bun server instance.
	 * @returns A Promise resolving to a Response object or undefined (for WebSocket upgrade).
	 */
	async fetch(req: Request, server) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);

        // Handle CORS preflight requests (OPTIONS)
        if (req.method === "OPTIONS") {
            console.log("Handling OPTIONS preflight request");
            return new Response(null, {
                status: 204, // No Content
                headers: corsHeaders,
            });
        }

		// Handle WebSocket upgrade requests
		if (pathname === "/ws") {
            // Optional: Check origin for WebSocket upgrade
            const origin = req.headers.get("origin");
            if (origin !== CLIENT_ORIGIN) {
                console.warn(`WebSocket upgrade rejected from origin: ${origin}`);
                // Send CORS headers even on rejection for consistency if browser expects them.
                return new Response("Forbidden: Invalid Origin", { status: 403, headers: corsHeaders });
            }

			const userData = { authToken: "user_" + Math.random().toString(16).slice(2) };
			const success = server.upgrade(req, {
				data: userData,
                // Bun automatically handles necessary headers for upgrade response
                // headers: { /* Optional custom headers */ }
			});
			if (success) {
				console.log(`WebSocket upgrade successful for ${req.headers.get("sec-websocket-key")}`);
				return; // Return undefined on successful upgrade
			} else {
				console.error(`WebSocket upgrade failed for ${req.headers.get("sec-websocket-key")}`);
				// Send CORS headers even on failure
				return new Response("WebSocket upgrade failed", { status: 400, headers: corsHeaders });
			}
		}

		// Basic HTTP Routing
		if (pathname === "/") {
			return new Response("SON Environment Server is running!", {
				headers: { "Content-Type": "text/plain", ...corsHeaders },
			});
		}

		// --- API Route Handling ---
		// Centralized place to add CORS headers to all API responses
		let apiResponse: Response | null = null;

		try {
			if (pathname.startsWith("/api/")) {
				// --- READ Endpoints ---
				if (req.method === "GET") {
					if (pathname === '/api/base-environment') {
						apiResponse = await getBaseEnvironment(db);
					} else if (pathname === '/api/classes') {
						apiResponse = await getClasses(db);
					} else {
						// Match /api/methods/{className}
						const methodsMatch = pathname.match(/^\/api\/methods\/([^\/]+)$/);
						if (methodsMatch) {
							const className = decodeURIComponent(methodsMatch[1]);
							apiResponse = await getMethods(db, className);
						} else {
							// Match /api/method/{className}/{selector}
							const methodSourceMatch = pathname.match(/^\/api\/method\/([^\/]+)\/(.+)$/);
							if (methodSourceMatch) {
								const className = decodeURIComponent(methodSourceMatch[1]);
								const selector = decodeURIComponent(methodSourceMatch[2]);
								apiResponse = await getMethodSource(db, className, selector);
							}
						}
					}
				}
				// --- WRITE Endpoints ---
				else if (req.method === 'POST' && pathname === '/api/method') {
                    try {
                        const data = await req.json(); // Parse request body as JSON
                        apiResponse = await saveMethod(db, data);
                    } catch (jsonError: any) {
                        // Handle JSON parsing errors specifically
                        console.error("Failed to parse request body JSON:", jsonError);
                        apiResponse = new Response(JSON.stringify({ error: "Invalid JSON in request body", details: jsonError.message }), {
                            status: 400, // Bad Request
                            headers: { "Content-Type": "application/json" },
                        });
                    }
				}

				// If an API route was processed, return the response with CORS headers
				if (apiResponse) {
					// Add CORS headers to the actual response from handlers
                    Object.entries(corsHeaders).forEach(([key, value]) => {
                        apiResponse!.headers.set(key, value);
                    });
					return apiResponse;
				} else {
                    // If API path but no specific handler matched
                    console.log(`API route not found: ${req.method} ${pathname}`);
                    return new Response(JSON.stringify({ error: "API route not found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json", ...corsHeaders },
                    });
                }
			}
		} catch (error: any) {
			// Catch unexpected errors during handler execution (e.g., DB errors not caught in handlers)
			console.error(`Error processing request ${req.method} ${pathname}:`, error);
			return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...corsHeaders },
			});
		}

		// Default 404 Not Found response if no route matched at all
		console.log(`Route not found: ${req.method} ${pathname}`);
		return new Response("Not Found", { status: 404, headers: corsHeaders });
	},

	// Attach the WebSocket handler configuration
	websocket: wsHandler,

	/**
	 * Handles errors during request processing *before* the fetch handler runs or general server errors.
	 * @param error The error object.
	 * @returns A Response object indicating an internal server error.
	 */
	error(error: Error) {
		console.error("Server error:", error);
		// Add CORS headers to error responses too
		return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
             status: 500,
             headers: { "Content-Type": "application/json", ...corsHeaders }
        });
	},
});

console.log(`SON Environment server listening on http://${server.hostname}:${server.port}`);

// Example: Log database path on startup
try {
    const result = db.query("PRAGMA database_list;").get();
    // @ts-expect-error - result might be unknown type, but structure is known for PRAGMA
    console.log(`Database file: ${result?.file ?? 'N/A'}`);
} catch (e) {
    console.error("Could not query database path:", e);
}