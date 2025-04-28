import { Database } from "bun:sqlite";
import path from "node:path";

// --- Configuration ---
const dbDir = path.join(import.meta.dir, "data");
const dbPath = path.join(dbDir, "son_environment.sqlite");
const NUMBER_CLASS_KEY = "Number";

// --- Data Definition for Number Class ---
const numberClassDefinition = {
    name: "Number", // Optional metadata
    // Define methods associated with the Number class
    methods: {
        "+": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberAdd:"
            body: [["primitive:NumberAdd:", "$self", "$aNumber"]]
        },
        "*": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberMultiply:"
            body: [["primitive:NumberMultiply:", "$self", "$aNumber"]]
        },
        "-": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberSubtract:"
            body: [["primitive:NumberSubtract:", "$self", "$aNumber"]]
        },
        "/": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberDivide:"
            // Note: Might need to handle division by zero in the primitive.
            body: [["primitive:NumberDivide:", "$self", "$aNumber"]]
        },
        "<": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberLessThan:"
            body: [["primitive:NumberLessThan:", "$self", "$aNumber"]]
        },
        ">": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberGreaterThan:"
            body: [["primitive:NumberGreaterThan:", "$self", "$aNumber"]]
        },
        "<=": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberLessOrEqual:"
            body: [["primitive:NumberLessOrEqual:", "$self", "$aNumber"]]
        },
        ">=": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberGreaterOrEqual:"
            body: [["primitive:NumberGreaterOrEqual:", "$self", "$aNumber"]]
        },
        "=": {
            argNames: ["aNumber"],
            // Placeholder: Interpreter needs to handle "primitive:NumberEquals:"
            body: [["primitive:NumberEquals:", "$self", "$aNumber"]]
        },
        // Add other common Number methods if needed (e.g., squared, sqrt, isZero, etc.)
        // "squared": {
        //     argNames: [],
        //     body: [["$self", "*", "$self"]] // Example implementation purely in SON
        // },
    }
};

// --- Database Interaction ---
let db: Database | null = null;

try {
    console.log(`Connecting to database at: ${dbPath}`);
    // Ensure the database file is created if it doesn't exist
    db = new Database(dbPath, { create: true });

    console.log(`Preparing to seed/update '${NUMBER_CLASS_KEY}' definition...`);

    // Convert the class definition object to a JSON string
    const valueJson = JSON.stringify(numberClassDefinition, null, 2); // Pretty print for readability in DB if needed

    // Prepare the SQL statement for inserting or updating the base environment entry
    // ON CONFLICT(key) DO UPDATE makes this operation idempotent
    const stmt = db.prepare(`
        INSERT INTO son_base_environment (key, value_json)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json;
    `);

    // Execute the statement
    const result = stmt.run(NUMBER_CLASS_KEY, valueJson);

    console.log(`Successfully seeded/updated '${NUMBER_CLASS_KEY}' definition.`);
    // Bun's run result might not have standard 'changes', check API if specific confirmation needed
    // console.log("Result:", result);

} catch (error: any) {
    console.error(`Error seeding database for key '${NUMBER_CLASS_KEY}':`, error);
    process.exitCode = 1; // Indicate failure
} finally {
    if (db) {
        console.log("Closing database connection.");
        db.close();
    }
}

console.log("Seed script finished.");