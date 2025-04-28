/**
 * <ai_info>
 * This file defines the core TypeScript types used throughout the SON (Smalltalk Object Notation)
 * interpreter and environment. It establishes the structure for SON values, objects, symbols,
 * arrays, block closures, and the execution environment. It now includes a formal definition
 * for `lookupMethodLocally` in the environment interface.
 * </ai_info>
 *
 * @file client/src/lib/son/types.ts
 * @description Core TypeScript types for the SON interpreter.
 */

/**
 * Represents a Smalltalk-style symbol in SON.
 */
export interface SonSymbol {
    '#': string;
}

/**
 * Represents a standard JSON array, used for sequences, message sends, etc. in SON.
 */
export type SonArray = SonValue[];

/**
 * Represents a standard JSON object, potentially used for SON objects (though structure may vary).
 * Also used for the Symbol literal format.
 */
export type SonObject = { [key: string]: SonValue } | SonSymbol;

/**
 * Interface for Method implementations (represents the data needed to execute a method).
 */
export interface SonMethodImplementation {
    __type: 'SonMethodImplementation';
    /** The names of the arguments the method expects. */
    argNames: string[];
    /** The SON code (typically an array of statements) representing the method body. */
    body: SonValue; // Usually SonArray
    /** The selector this implementation corresponds to (useful for debugging). */
    selector?: string; // Optional: Add selector info if helpful
}


/**
 * Represents the execution environment or scope in which SON code is evaluated.
 * It provides methods for variable lookup (`get`), assignment (`set`),
 * and potentially method definition/lookup later.
 */
export interface ISonEnvironment {
    /**
     * Retrieves the value of a variable from the environment or its ancestors.
     * @param name - The name of the variable to retrieve (without the leading '$').
     * @returns The value of the variable.
     * @throws {VariableNotFoundError} If the variable is not found in the current or any parent environment.
     */
    get(name: string): SonValue;

    /**
     * Sets the value of a variable in the current environment scope.
     * @param name - The name of the variable to set (without the leading '$').
     * @param value - The value to assign to the variable.
     */
    set(name: string, value: SonValue): void;

    /**
     * Creates a new child environment that inherits from this environment.
     * Used for creating new lexical scopes (e.g., for block or method execution).
     * @param options - Optional configuration for the child environment.
     * @param options.isMethodContext - Mark this environment as representing a method's execution context.
     * @param options.methodSelf - Reference to the 'self' object within a method context.
     * @returns A new SonEnvironment instance whose parent is the current environment.
     */
    createChild(options?: { isMethodContext?: boolean; methodSelf?: SonValue }): ISonEnvironment;

    /** Checks if this environment represents the top-level context of a method execution. */
    isMethodContext(): boolean;

    /** Gets the receiver ('self') of the method if this is a method context. */
    getMethodSelf(): SonValue | undefined;

    /** Gets the parent environment. */
    getParent(): ISonEnvironment | null;

    /** Defines a method within this environment's scope (e.g., for a class definition). */
    defineMethod(selector: string, argNames: string[], body: SonValue): void;

    /**
     * Looks up a method implementation based on the selector for a given receiver type/class.
     * This might involve searching the class hierarchy in the future.
     * @param receiver - The object receiving the message (used to determine class).
     * @param selector - The method selector string.
     * @returns The method implementation details or null if not found in the hierarchy.
     */
    lookupMethod(receiver: SonValue, selector: string): SonMethodImplementation | null;

    /**
     * Looks up a method definition directly within this environment's own scope.
     * Does not search parent environments (used for checking methods defined directly on an object/class).
     * @param selector - The method selector string.
     * @returns The method implementation details or null if not found locally.
     */
    lookupMethodLocally(selector: string): SonMethodImplementation | null;
}


/**
 * Represents a block closure in SON.
 */
export interface SonBlock {
    /** Distinguisher for type guards */
    __type: 'SonBlock';
    /** The names of the block arguments. */
    argNames: string[];
    /** The SON code array representing the block's body. */
    body: SonArray;
    /** The lexical environment captured when the block was defined. */
    lexicalScope: ISonEnvironment;
    /** The environment of the method context in which the block was defined. Needed for non-local returns. */
    homeContext: ISonEnvironment;
}

// Forward declaration to avoid circular dependency issues if types become complex
export type SonValue =
    | number
    | string
    | boolean
    | null
    | SonSymbol // e.g., { '#': 'mySymbol' }
    | SonObject // e.g., { 'key': 'value' } or potentially SON objects later
    | SonArray // e.g., [1, '+', 2] or ['stmt1', 'stmt2']
    | SonBlock; // Block closure object