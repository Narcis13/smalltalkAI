/**
 * <ai_info>
 * This file implements the `SonEnvironment` class, which represents the execution
 * context (scope) for the SON interpreter. It handles variable storage, lookup
 * (with lexical scoping through parent environments), and assignment.
 * It now includes flags/properties (`_isMethodContext`, `_methodSelf`) to identify
 * method contexts, which is crucial for handling return semantics (`^`).
 * It also implements `defineMethod` and `lookupMethodLocally` to manage methods
 * defined directly within this environment (e.g., for class definitions).
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
 * - Identifies method contexts via `isMethodContext` flag.
 * - Stores method receiver (`self`) in `methodSelf` property for method contexts.
 * - Stores and looks up locally defined methods via `defineMethod` and `lookupMethodLocally`.
 */

import { ISonEnvironment, SonValue, SonMethodImplementation } from './types';
import { VariableNotFoundError } from './errors';

/**
 * Implements the ISonEnvironment interface to manage lexical scopes.
 */
export class SonEnvironment implements ISonEnvironment {
    private variables: Map<string, SonValue>;
    private readonly parent: ISonEnvironment | null;
    private readonly _isMethodContext: boolean;
    private readonly _methodSelf: SonValue | undefined; // Store 'self' for method contexts

    // Stores methods defined directly in this scope (e.g., class methods)
    private methods: Map<string, SonMethodImplementation>;

    /**
     * Creates a new SonEnvironment instance.
     * @param parent - The parent environment for lexical scoping, or null for the root environment.
     * @param options - Optional configuration for the environment.
     * @param options.isMethodContext - Mark this environment as representing a method's execution context.
     * @param options.methodSelf - Reference to the 'self' object within a method context.
     */
    constructor(parent: ISonEnvironment | null = null, options?: { isMethodContext?: boolean; methodSelf?: SonValue }) {
        this.variables = new Map<string, SonValue>();
        this.parent = parent;
        this._isMethodContext = options?.isMethodContext ?? false;
        this._methodSelf = options?.methodSelf;
        this.methods = new Map<string, SonMethodImplementation>(); // Initialize methods map

        // Automatically define 'self' if this is a method context
        if (this._isMethodContext && this._methodSelf !== undefined) {
            this.variables.set('self', this._methodSelf);
        }
        // Define 'super' later if needed
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
            return this.variables.get(name)!; // Use non-null assertion as `has` confirms existence
        }

        if (this.parent !== null) {
            // Delegate lookup to the parent environment
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
        this.variables.set(name, value);
    }

    /**
     * Creates a new child environment that inherits from this environment.
     * The new environment's parent will be the current environment instance.
     * @param options - Optional configuration for the child environment.
     * @param options.isMethodContext - Mark this environment as representing a method's execution context.
     * @param options.methodSelf - Reference to the 'self' object within a method context.
     * @returns A new SonEnvironment instance linked to the current one.
     */
    createChild(options?: { isMethodContext?: boolean; methodSelf?: SonValue }): ISonEnvironment {
        return new SonEnvironment(this, options);
    }

    /**
     * Checks if this environment represents the top-level context of a method execution.
     * @returns True if this is a method context, false otherwise.
     */
    isMethodContext(): boolean {
        return this._isMethodContext;
    }

    /**
     * Gets the receiver ('self') of the method if this is a method context.
     * @returns The receiver ('self') object or undefined if not a method context.
     */
    getMethodSelf(): SonValue | undefined {
        return this._methodSelf;
    }

     /**
     * Gets the parent environment.
     * @returns The parent ISonEnvironment or null.
     */
    getParent(): ISonEnvironment | null {
        return this.parent;
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
        let str = `{ (MethodCtx: ${this._isMethodContext}) vars: { `;
        this.variables.forEach((value, key) => {
             try {
                 // Basic string representation for blocks
                 if (value && typeof value === 'object' && (value as any).__type === 'SonBlock') {
                     str += `${key}: [BlockClosure], `;
                 } else {
                    // Limit length of stringified value for readability
                     const valStr = JSON.stringify(value);
                     str += `${key}: ${valStr.length > 50 ? valStr.substring(0, 47) + '...' : valStr}, `;
                 }
             } catch (e) {
                 str += `${key}: [Unserializable], `; // Handle non-JSON values
             }
        });
        str = str.endsWith(', ') ? str.slice(0, -2) : str;
        str += ' }, methods: [';
        str += Array.from(this.methods.keys()).join(', ');
        str += '] }';

        if (depth > 0 && this.parent instanceof SonEnvironment) {
             str += `\n  parent: ${this.parent.dumpScope(depth - 1)}`;
        } else if (this.parent) {
             str += `\n  parent: [Non-SonEnvironment Parent]`;
        }
        return str;
    }


    // --- Method Handling ---

    /**
     * Defines a method directly within this environment's scope (e.g., in a class definition).
     * @param selector - The method selector string.
     * @param argNames - An array of argument names.
     * @param body - The SON code representing the method body.
     */
    defineMethod(selector: string, argNames: string[], body: SonValue): void {
        console.log(`Environment: Defining method #${selector} with args ${JSON.stringify(argNames)} in scope ${this._isMethodContext ? 'Method' : 'Object/Class'}`);
        const implementation: SonMethodImplementation = {
             __type: 'SonMethodImplementation',
             argNames,
             body,
             selector // Store selector for debugging
        };
        this.methods.set(selector, implementation);
    }

    /**
     * Looks up a method implementation within this environment or its parent chain (for class hierarchy).
     * Placeholder for actual class-based lookup. Currently only checks local methods map.
     * TODO: Implement real class hierarchy lookup (super lookup) when classes/inheritance are fully defined.
     *
     * @param receiver - The object receiving the message (needed to determine class).
     * @param selector - The method selector.
     * @returns The method implementation details or null if not found.
     */
    lookupMethod(receiver: SonValue, selector: string): SonMethodImplementation | null {
        // For now, assume lookup happens on the class object itself.
        // This method on the environment isn't the primary lookup path currently.
        // The interpreter calls getClassOf(receiver) then lookupMethodLocally on the class.
        // This might be used later for 'super' sends.
        return this.lookupMethodLocally(selector);
    }

    /**
     * Looks up a method definition directly within this environment's own scope (e.g., on a class).
     * Does not search parent environments.
     * @param selector - The method selector string.
     * @returns The method implementation details or null if not found locally.
     */
    lookupMethodLocally(selector: string): SonMethodImplementation | null {
         return this.methods.get(selector) || null;
    }
}