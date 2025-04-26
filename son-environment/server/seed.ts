/**
 * @file server/seed.ts
 * @description Seeds the SON Environment SQLite database with initial data.
 *              Run this script using `bun run seed.ts` from the server directory.
 *
 * Includes:
 * - Clearing existing data (optional but recommended for repeatable seeding).
 * - Seeding son_base_environment with core objects/values.
 * - Seeding son_classes with example class names.
 * - Seeding son_methods with example method definitions for those classes.
 */

import { db } from "./db"; // Import the initialized database instance
// Using hardcoded UUIDs for predictability in seed data
// You could use randomUUID() if preferred, but fixed IDs are easier for testing relations.

const seedData = {
	baseEnvironment: [
		{ key: "nil", value: null },
		{ key: "true", value: true },
		{ key: "false", value: false },
		// Using plain objects as placeholders for class representations in the base env
		// The actual class logic would be defined by methods associated later.
		{ key: "Object", value: { '#': 'ObjectClass', name: 'Object' } },
		{ key: "Number", value: { '#': 'NumberClass', name: 'Number' } },
		{ key: "String", value: { '#': 'StringClass', name: 'String' } },
		{ key: "Boolean", value: { '#': 'BooleanClass', name: 'Boolean' } },
		{ key: "BlockClosure", value: { '#': 'BlockClosureClass', name: 'BlockClosure' } },
		// Transcript is often a global singleton instance in Smalltalk environments
		{ key: "Transcript", value: { '#': 'TranscriptInstance', class: 'Transcript' } },
	],
	classes: [
		{ id: "object-uuid", name: "Object" }, // Base class
		{ id: "counter-uuid", name: "Counter" },
		{ id: "point-uuid", name: "Point" },
		{ id: "transcript-class-uuid", name: "Transcript" }, // Class for the Transcript instance
        // Add more classes as needed...
        { id: "number-class-uuid", name: "Number"},
        { id: "string-class-uuid", name: "String"},
        { id: "boolean-class-uuid", name: "Boolean"},
        { id: "blockclosure-class-uuid", name: "BlockClosure"},
	],
	methods: [
		// --- Object Methods ---
		{ classId: "object-uuid", selector: "initialize", args: [], body: [["^", "self"]] },
		{ classId: "object-uuid", selector: "class", args: [], body: [["^", { "#": "ObjectClass" }]] }, // Placeholder
		{ classId: "object-uuid", selector: "error:", args: ["message"], body: [["self", "primitiveFailed"]] }, // Placeholder for primitive/native call

		// --- Counter Methods ---
		{ classId: "counter-uuid", selector: "initialize", args: [], body: [["self", "value:", 0]] }, // Assumes assignment works via 'value:'
		{ classId: "counter-uuid", selector: "value", args: [], body: [["^", "$value"]] }, // Assumes $value is an instance variable
		{ classId: "counter-uuid", selector: "value:", args: ["newValue"], body: [["$value", "=", "$newValue"], ["^", "self"]] }, // Uses pseudo-assignment `[["var", "=", value]]` for storage
		{ classId: "counter-uuid", selector: "increment", args: [], body: [["self", "value:", ["$value", "+", 1]]] },
		{ classId: "counter-uuid", selector: "incrementBy:", args: ["amount"], body: [["self", "value:", ["$value", "+", "$amount"]]] },
		{ classId: "counter-uuid", selector: "printString", args: [], body: [["^", ["'Counter value: '", "++", ["$value", "printString"]]]] }, // Requires string concatenation `++` and `printString` on Number

		// --- Point Methods ---
		{ classId: "point-uuid", selector: "initialize", args: [], body: [["self", "x:y:", 0, 0]] },
		{ classId: "point-uuid", selector: "x", args: [], body: [["^", "$x"]] }, // Assumes $x is ivar
		{ classId: "point-uuid", selector: "y", args: [], body: [["^", "$y"]] }, // Assumes $y is ivar
		{ classId: "point-uuid", selector: "x:", args: ["newX"], body: [["$x", "=", "$newX"], ["^", "self"]] },
		{ classId: "point-uuid", selector: "y:", args: ["newY"], body: [["$y", "=", "$newY"], ["^", "self"]] },
		{ classId: "point-uuid", selector: "x:y:", args: ["newX", "newY"], body: [["$x", "=", "$newX"], ["$y", "=", "$newY"], ["^", "self"]] },
		{ classId: "point-uuid", selector: "+", args: ["otherPoint"], body: [["^", [{ "#": "Point" }, "x:y:", ["$x", "+", ["$otherPoint", "x"]], ["$y", "+", ["$otherPoint", "y"]]]]] }, // Needs Point class lookup/creation
		{ classId: "point-uuid", selector: "printString", args: [], body: [["^", [[["$x", "printString"], "++", "'@'"], "++", ["$y", "printString"]]]] },

		// --- Transcript Methods ---
		{ classId: "transcript-class-uuid", selector: "show:", args: ["aString"], body: [["console", "log:", "$aString"], ["^", "self"]] }, // Example native call via 'console' object
		{ classId: "transcript-class-uuid", selector: "cr", args: [], body: [["self", "show:", "'\\n'"]] }, // Newline

        // --- Number Methods (Examples) ---
        { classId: "number-class-uuid", selector: "+", args: ["aNumber"], body: [["self", "primitiveAdd:", "$aNumber"]] }, // Placeholder for primitive
        { classId: "number-class-uuid", selector: "-", args: ["aNumber"], body: [["self", "primitiveSubtract:", "$aNumber"]] }, // Placeholder for primitive
        { classId: "number-class-uuid", selector: "printString", args: [], body: [["self", "primitiveAsString"]] }, // Placeholder for primitive

        // --- String Methods (Examples) ---
        { classId: "string-class-uuid", selector: "++", args: ["aString"], body: [["self", "primitiveConcatenate:", "$aString"]] }, // Placeholder for primitive
        { classId: "string-class-uuid", selector: "printString", args: [], body: [["^", "self"]] },

        // --- Boolean Methods (Examples) ---
        { classId: "boolean-class-uuid", selector: "ifTrue:", args: ["trueBlock"], body: [["self", "ifTrue:ifFalse:", "$trueBlock", [["^", "nil"]]]] }, // Needs block eval
        { classId: "boolean-class-uuid", selector: "ifFalse:", args: ["falseBlock"], body: [["self", "ifTrue:ifFalse:", [["^", "nil"]], "$falseBlock"]] }, // Needs block eval
        { classId: "boolean-class-uuid", selector: "ifTrue:ifFalse:", args: ["trueBlock", "falseBlock"], body: [["self", "primitiveIfTrue:IfFalse:", "$trueBlock", "$falseBlock"]] }, // Placeholder

	],
};

async function seedDatabase() {
	console.log("Starting database seeding...");

	try {
		// Use a transaction for atomicity and performance
		db.transaction(() => {
			console.log("Clearing existing data...");
			db.run("DELETE FROM son_methods;");
			db.run("DELETE FROM son_classes;");
			db.run("DELETE FROM son_base_environment;");
            // Reset autoincrement sequence if tables had AUTOINCREMENT (not used here, but good practice if they did)
            // db.run("DELETE FROM sqlite_sequence WHERE name IN ('son_classes', 'son_methods', 'son_base_environment');");


			console.log("Seeding son_base_environment...");
			const insertBaseEnv = db.prepare(
				"INSERT INTO son_base_environment (key, value_json) VALUES (?, ?);"
			);
			for (const item of seedData.baseEnvironment) {
				insertBaseEnv.run(item.key, JSON.stringify(item.value));
			}
			console.log(`Inserted ${seedData.baseEnvironment.length} base environment entries.`);

			console.log("Seeding son_classes...");
			const insertClass = db.prepare(
				"INSERT INTO son_classes (id, name) VALUES (?, ?);"
			);
			for (const cls of seedData.classes) {
				insertClass.run(cls.id, cls.name);
			}
            console.log(`Inserted ${seedData.classes.length} classes.`);

			console.log("Seeding son_methods...");
			const insertMethod = db.prepare(`
                INSERT INTO son_methods (id, class_id, selector, arguments_json, body_json)
                VALUES (?, ?, ?, ?, ?);
            `);
			let methodCount = 0;
			for (const method of seedData.methods) {
                // Generate a unique ID for each method entry for the primary key
				const methodId = `${method.classId}-${method.selector}-uuid`; // Simple predictable UUID
				insertMethod.run(
					methodId,
					method.classId,
					method.selector,
					JSON.stringify(method.args), // Ensure args array is stringified
					JSON.stringify(method.body)  // Ensure body array is stringified
				);
				methodCount++;
			}
            console.log(`Inserted ${methodCount} methods.`);

		})(); // Immediately invoke the transaction

		console.log("Database seeding completed successfully.");

	} catch (error) {
		console.error("Database seeding failed:", error);
	} finally {
		// Optional: Close the DB connection if this script is meant to be run standalone
		// and not part of a larger server process. In this case, db is imported
		// and likely managed by the main server.ts, so closing might be undesirable here.
		// db.close();
	}
}

// Run the seeding function
seedDatabase();