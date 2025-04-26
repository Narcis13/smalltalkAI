/**
 * <ai_info>
 * This file implements the `SonEnvironment` class, which represents the execution
 * context (scope) for the SON interpreter. It handles variable storage, lookup
 * (with lexical scoping through parent environments), and assignment.
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
            try {
                return this.parent.get(name);
            } catch (e) {
                if (e instanceof VariableNotFoundError) {
                    // If parent chain didn't find it, re-throw the specific error
                     throw e;
                } else {
                     // Rethrow unexpected errors
                     throw e;
                }
            }
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
     * Utility method for debugging: Gets a string representation of the local variables.
     * @returns A string listing local variables.
     */
    dumpLocals(): string {
        let str = '{ ';
        this.variables.forEach((value, key) => {
            str += `${key}: ${JSON.stringify(value)}, `;
        });
         return str.length > 2 ? str.slice(0, -2) + ' }' : '{ }';
    }

    // TODO: Implement method definition/lookup later
    // defineMethod(selector: string, args: string[], body: SonValue): void {
    //   // ... logic to store method definition ...
    // }
    // lookupMethod(receiver: SonValue, selector: string): SonValue {
    //   // ... logic to find method implementation ...
    // }
}