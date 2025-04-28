/**
 * <ai_info>
 * This file handles SQLite database initialization, schema creation, and seeding
 * for the SON Environment backend. It uses `bun:sqlite` for database operations.
 * It now includes a `seedDatabase` function to populate the `son_base_environment`
 * table with core definitions for Object, Number, String, Boolean, BlockClosure, Symbol,
 * Transcript, and the JSBridge. The `initializeDatabase` function ensures tables
 * are created and seeding occurs only if the base environment table is initially empty.
 * </ai_info>
 *
 * @file server/db.ts
 * @description SQLite database initialization, schema setup, and seeding.
 *
 * Key features:
 * - Initializes a connection to the SQLite database (`son_environment.sqlite`).
 * - Defines and creates the necessary tables (`son_classes`, `son_methods`, `son_base_environment`).
 * - Includes a `seedDatabase` function to populate `son_base_environment` with essential definitions.
 * - Ensures seeding only happens once on an empty database.
 * - Exports the initialized database instance.
 *
 * @dependencies
 * - bun:sqlite: Built-in Bun module for SQLite interaction.
 * - node:crypto: For generating UUIDs (though Bun's `crypto.randomUUID()` is preferred).
 * - node:fs: For checking if DB file exists (optional).
 *
 * @notes
 * - Database file is stored in `server/data/son_environment.sqlite`.
 * - Error handling for database operations should be added in query functions.
 * - Seeding data provides the fundamental building blocks for the SON runtime.
 */
import { Database } from "bun:sqlite";
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

// Define the path to the data directory and the database file
const dataDir = join(import.meta.dir, 'data');
const dbPath = join(dataDir, "son_environment.sqlite");

// Ensure the data directory exists
try {
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
        console.log(`Created data directory: ${dataDir}`);
    }
} catch (err) {
    console.error("Failed to create data directory:", err);
    // Decide if process should exit or continue without db
    process.exit(1); // Exit if we can't ensure data directory
}


console.log(`Database path: ${dbPath}`);

// Initialize the database connection
let db: Database;
try {
     db = new Database(dbPath, { create: true }); // Creates the file if it doesn't exist
     console.log("Database connection opened successfully.");
} catch (err) {
     console.error("Failed to open database connection:", err);
     process.exit(1); // Exit if DB cannot be opened
}


/**
 * Creates the necessary database tables if they don't already exist.
 */
const createTables = () => {
    console.log("Creating database tables if they don't exist...");
    try {
        db.run(`
            CREATE TABLE IF NOT EXISTS son_classes (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_son_classes_name ON son_classes(name);`);

        db.run(`
            CREATE TABLE IF NOT EXISTS son_methods (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL REFERENCES son_classes(id) ON DELETE CASCADE,
                selector TEXT NOT NULL,
                arguments_json TEXT NOT NULL,
                body_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(class_id, selector)
            );
        `);
        db.run(`CREATE INDEX IF NOT EXISTS idx_son_methods_class_id ON son_methods(class_id);`);

        db.run(`
            CREATE TABLE IF NOT EXISTS son_base_environment (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL
            );
        `);
        console.log("Table creation check complete.");
    } catch (err) {
        console.error("Failed to create database tables:", err);
        throw err; // Re-throw to stop initialization if tables fail
    }
};

/**
 * Seeds the `son_base_environment` table with essential definitions.
 * This should only run if the table is empty.
 */
const seedDatabase = () => {
    console.log("Checking if database seeding is required...");
    try {
        // Check if the base environment table is empty
        const countResult = db.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM son_base_environment`).get();

        if (countResult && countResult.count > 0) {
            console.log("Database already seeded. Skipping.");
            return;
        }

        console.log("Seeding son_base_environment table...");

        // Define the base environment seed data
        // Uses 'primitive:' marker for methods implemented by the interpreter primitive handler.
        const baseEnvSeedData: Record<string, any> = {
            // --- Core Classes (Structure based on mergeBaseEnvironment expectations) ---
            "Object": {
                "methods": {
                    "==":           { "argNames": ["other"], "body": ["primitive:Equals:", "$self", "$other"]},
                    "~=":           { "argNames": ["other"], "body": ["primitive:NotEquals:", "$self", "$other"]},
                    "===":          { "argNames": ["other"], "body": ["primitive:IdentityEquals:", "$self", "$other"]},
                    "~~=":          { "argNames": ["other"], "body": ["primitive:IdentityNotEquals:", "$self", "$other"]},
                    "class":        { "argNames": [],        "body": ["primitive:Class:", "$self"] },
                    "printString":  { "argNames": [],        "body": `"an Object"` }, // Basic fallback
                    // Add basic error handling, subclass responsibility etc. later
                }
            },
            "Number": {
                 // Inheritance not explicitly modeled here, but assumes Object methods are available via lookup fallback
                "methods": {
                    "+":  { "argNames": ["aNumber"], "body": ["primitive:NumberAdd:", "$self", "$aNumber"] },
                    "-":  { "argNames": ["aNumber"], "body": ["primitive:NumberSubtract:", "$self", "$aNumber"] },
                    "*":  { "argNames": ["aNumber"], "body": ["primitive:NumberMultiply:", "$self", "$aNumber"] },
                    "/":  { "argNames": ["aNumber"], "body": ["primitive:NumberDivide:", "$self", "$aNumber"] },
                    "<":  { "argNames": ["aNumber"], "body": ["primitive:NumberLessThan:", "$self", "$aNumber"] },
                    ">":  { "argNames": ["aNumber"], "body": ["primitive:NumberGreaterThan:", "$self", "$aNumber"] },
                    "<=": { "argNames": ["aNumber"], "body": ["primitive:NumberLessOrEqual:", "$self", "$aNumber"] },
                    ">=": { "argNames": ["aNumber"], "body": ["primitive:NumberGreaterOrEqual:", "$self", "$aNumber"] },
                    "==": { "argNames": ["aNumber"], "body": ["primitive:NumberEquals:", "$self", "$aNumber"] }, // Specific number equality
                    "printString": { "argNames": [], "body": ["primitive:NumberToString:", "$self"] } // Needs primitive
                }
            },
            "String": {
                 "methods": {
                    ",": { "argNames": ["aString"], "body": ["primitive:StringConcatenate:", "$self", "$aString"] }, // Needs primitive
                    "printString": { "argNames": [], "body": "$self" } // Strings print as themselves
                     // Add length, comparison, etc. later
                 }
            },
            "Boolean": {
                 "methods": {
                    "&":        { "argNames": ["aBoolean"], "body": ["primitive:BooleanAnd:", "$self", "$aBoolean"] },
                    "|":        { "argNames": ["aBoolean"], "body": ["primitive:BooleanOr:", "$self", "$aBoolean"] },
                    "not":      { "argNames": [],           "body": ["primitive:BooleanNot", "$self"] },
                    "ifTrue:":  { "argNames": ["trueBlock"], "body": ["primitive:BooleanIfTrue:", "$self", "$trueBlock"] },
                    "ifFalse:": { "argNames": ["falseBlock"],"body": ["primitive:BooleanIfFalse:", "$self", "$falseBlock"] },
                    "ifTrue:ifFalse:": { "argNames": ["trueBlock", "falseBlock"], "body": ["primitive:BooleanIfTrueIfFalse:", "$self", "$trueBlock", "$falseBlock"] },
                     "printString": { "argNames": [], "body": ["primitive:BooleanToString:", "$self"] } // Needs primitive
                 }
            },
             "BlockClosure": {
                 "methods": {
                     // value, value:, value:value: etc. are handled directly by sendMessage based on type check
                     // We could define methods like whileTrue:, whileFalse: here
                     "whileTrue:": {
                         "argNames": ["bodyBlock"],
                         "body": [
                             // Loop structure:
                             // L1: [conditionBlock value] ifFalse: [^ self]. "Evaluate condition, exit loop if false"
                             //     [bodyBlock value].                  "Execute body"
                             //     -> L1                               "Loop back (implicit)" - This needs loop construct or recursion.

                             // Recursive approach (potential stack overflow for long loops):
                             // Define recursive helper? Or implement loop primitive?
                             // For now, leave unimplemented or use JSBridge setTimeout for pseudo-loop.
                              ["$Transcript", "show:", "'whileTrue:' not fully implemented in base env."],
                              {"#": "NotImplemented"} // Placeholder return
                         ]
                     },
                     "printString": { "argNames": [], "body": `"a BlockClosure"` }
                 }
             },
            "Symbol": {
                 "methods": {
                     "printString": { "argNames": [], "body": ["primitive:SymbolToString:", "$self"] } // Needs primitive
                 }
             },
            "UndefinedObject": { // Class for 'null'
                "methods": {
                    "ifNil:": { "argNames": ["nilBlock"], "body": ["$nilBlock", "value"] }, // Execute block if receiver is nil
                    "ifNotNil:": { "argNames": ["notNilBlock"], "body": "null" }, // Do nothing if receiver is nil
                    "ifNil:ifNotNil:": { "argNames": ["nilBlock", "notNilBlock"], "body": ["$nilBlock", "value"] },
                     "printString": { "argNames": [], "body": `"nil"` }
                 }
            },

            // --- Core Objects (non-class structures) ---
            "Transcript": {
                // The actual implementation is injected dynamically by Workspace to interact with React state.
                // This definition just signals its existence and expected methods.
                "methods": {
                    "show:": { "argNames": ["anObject"], "body": [] }, // Body is ignored by dynamic injection
                    "cr":    { "argNames": [],           "body": [] }
                }
            },
            "JSBridge": {
                // Special marker for the context provider to identify and instantiate
                "__isJSBridge": true,
                // Methods are placeholders; actual implementation is JS functions attached in context provider.
                "methods": {
                    "log:": { "argNames": ["anObject"], "body": null },
                    "setTimeout:delay:": { "argNames": ["aBlock", "delayMs"], "body": null },
                    "fetch:options:": { "argNames": ["url", "options"], "body": null }
                }
            }
        };

        // Prepare statement for insertion
        const insertStmt = db.prepare(`INSERT INTO son_base_environment (key, value_json) VALUES (?, ?)`);

        // Insert data within a transaction
        const insertMany = db.transaction((data) => {
            for (const key in data) {
                try {
                    const valueJson = JSON.stringify(data[key]);
                    insertStmt.run(key, valueJson);
                    console.log(` -> Seeded base environment key: ${key}`);
                } catch (err) {
                     console.error(`Failed to stringify or insert base env key '${key}':`, err);
                     // Decide whether to continue or abort transaction
                     throw new Error(`Seeding failed for key ${key}`);
                }
            }
        });

        insertMany(baseEnvSeedData);
        console.log("Database seeding complete.");

    } catch (err) {
        console.error("Failed during database seeding check or process:", err);
        throw err; // Propagate error
    }
};

/**
 * Initializes the database by creating tables and seeding if necessary.
 */
const initializeDatabase = () => {
    console.log("Initializing database...");
    try {
        db.exec("PRAGMA journal_mode = WAL;"); // Improve concurrency
        db.exec("PRAGMA foreign_keys = ON;"); // Ensure foreign key constraints are enforced
        createTables();
        seedDatabase();
        console.log("Database initialization complete.");
    } catch (err) {
        console.error("Database initialization failed:", err);
        // Close the DB connection if initialization fails?
        db.close();
        process.exit(1); // Exit if critical DB setup fails
    }
};

// Initialize the database on module load
initializeDatabase();


export { db };