/**
 * <ai_info>
 * This file implements the `SonEnvironment` class, which represents the execution
 * context (scope) for the SON interpreter. It handles variable storage, lookup
 * (with lexical scoping through parent environments), and assignment.
 * No changes were needed for Step 16, as the existing `set` method correctly
 * modifies the current scope as required by assignment semantics.
 * </ai_info>
 *
 * @file client/src/lib/son/environment.ts
 * @description Manages the $env execution context for the SON interpreter.
 *
 * Key features:
 * - Stores variables in a Map.
 * - Supports prototypical inheritance for lexical scoping via a `parent` reference.
 * - `get` method searches current and parent scopes.
 * - `set` method modifies the current scope only.
 * - `createChild` method creates nested scopes.
 */

import { ISonEnvironment, SonValue } from './types';
import { VariableNotFoundError } from './errors';

/**
 * Implements the ISonEnvironment interface to manage lexical scopes.
 */
export class SonEnvironment implements ISonEnvironment {
    private variables: Map<string, SonValue>;
    private readonly parent: ISonEnvironment | null;

    /**
     * Creates a new SonEnvironment instance.
     * @param parent - The parent environment for lexical scoping, or null for the root environment.
     */
    constructor(parent: ISonEnvironment | null = null) {
        this.variables = new Map<string, SonValue>();
        this.parent = parent;
    }

    /**
     * Retrieves the value of a variable from the environment or its ancestors.
     * Follows the prototype chain (parent environments) if not found locally.
     * @param name - The name of the variable to retrieve (without the leading '$').
     * @returns The value of the variable.
     * @throws {VariableNotFoundError} If the variable is not found in the current or any parent environment.
     */
    get(name: string): SonValue {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }

        if (this.parent !== null) {
            // Delegate lookup to the parent environment
            // No try-catch needed here; if parent throws VariableNotFoundError, let it propagate.
            return this.parent.get(name);
        }

        // Reached the root environment and still not found
        throw new VariableNotFoundError(name);
    }

    /**
     * Sets the value of a variable in the *current* environment scope.
     * Does not delegate to parent environments; assignment always occurs locally.
     * @param name - The name of the variable to set (without the leading '$').
     * @param value - The value to assign to the variable.
     */
    set(name: string, value: SonValue): void {
        // Smalltalk assignment semantics: assign in the current scope.
        // If shadowing is needed, blocks/methods must create child environments.
        this.variables.set(name, value);
    }

    /**
     * Creates a new child environment that inherits from this environment.
     * The new environment's parent will be the current environment instance.
     * @returns A new SonEnvironment instance linked to the current one.
     */
    createChild(): ISonEnvironment {
        return new SonEnvironment(this);
    }

    /**
     * Utility method to check if a variable exists in the current scope only.
     * @param name The variable name.
     * @returns True if the variable exists locally, false otherwise.
     */
    hasLocal(name: string): boolean {
        return this.variables.has(name);
    }

    /**
     * Utility method for debugging: Gets a string representation of the local variables
     * and optionally parent variables recursively.
     * @param depth - How many parent levels to dump (0 for local only).
     * @returns A string listing variables in scope.
     */
    dumpScope(depth: number = 0): string {
        let str = '{ ';
        this.variables.forEach((value, key) => {
             try {
                 str += `${key}: ${JSON.stringify(value)}, `;
             } catch (e) {
                 str += `${key}: [Unserializable], `; // Handle non-JSON values
             }
        });
        str = str.length > 2 ? str.slice(0, -2) + ' }' : '{ }';

        if (depth > 0 && this.parent instanceof SonEnvironment) {
             str += `\n  parent: ${this.parent.dumpScope(depth - 1)}`;
        } else if (this.parent) {
             str += `\n  parent: [Non-SonEnvironment Parent]`;
        }
        return str;
    }


    // --- Method Handling (Future Implementation) ---
    // Storing methods directly in the environment might be one approach,
    // especially for global functions or methods defined on the environment itself.
    // Methods for specific objects/classes would typically be stored elsewhere
    // (e.g., in a class structure looked up via the object's class pointer).

    // Example placeholder structure (adapt as needed):
    private methods: Map<string, { args: string[], body: SonValue }> = new Map();

    /**
     * Defines a method directly within this environment's scope.
     * Note: This might be used for global functions or methods on the environment object itself.
     * Methods on specific SON classes/objects will likely be handled differently.
     * @param selector - The method selector string.
     * @param args - An array of argument names.
     * @param body - The SON code representing the method body.
     */
    defineMethod(selector: string, args: string[], body: SonValue): void {
        console.log(`Environment: Defining method #${selector} with args ${JSON.stringify(args)}`);
        this.methods.set(selector, { args, body });
        // Maybe store the method implementation directly on 'this.variables' too?
        // e.g., this.set(selector, someFunctionWrapper); // Needs careful design.
    }

    /**
     * Looks up a method implementation within this environment.
     * This is a simplified lookup, primarily for methods defined directly on the environment.
     * Real method lookup involves class hierarchy traversal.
     * @param selector - The method selector.
     * @returns The method definition ({args, body}) or null if not found locally.
     */
    lookupMethodLocally(selector: string): { args: string[], body: SonValue } | null {
         return this.methods.get(selector) || null;
    }

    // `lookupMethod(receiver, selector)` would be more complex, involving `receiver`'s class.
}