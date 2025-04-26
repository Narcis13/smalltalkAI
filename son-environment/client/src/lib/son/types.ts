/**
 * <ai_info>
 * This file defines the core TypeScript types used throughout the SON (Smalltalk Object Notation)
 * interpreter and environment. It establishes the structure for SON values, objects, symbols,
 * arrays, and the execution environment.
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
 * Represents any valid value within the SON environment.
 * This includes primitive types, symbols, objects, and arrays.
 */
export type SonValue =
    | number
    | string
    | boolean
    | null
    | SonSymbol // e.g., { '#': 'mySymbol' }
    | SonObject // e.g., { 'key': 'value' } or potentially SON objects later
    | SonArray; // e.g., [1, '+', 2] or ['stmt1', 'stmt2']

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
     * @returns A new SonEnvironment instance whose parent is the current environment.
     */
    createChild(): ISonEnvironment;

    // TODO: Add methods for method definition and lookup as interpreter evolves
    // defineMethod(selector: string, args: string[], body: SonValue): void;
    // lookupMethod(receiver: SonValue, selector: string): SonValue; // Returns method implementation
}

// Interface for Block closures (to be defined later)
// export interface SonBlock {
//     type: 'block';
//     args: string[];
//     body: SonValue;
//     capturedEnv: ISonEnvironment;
//     // Method to evaluate the block
//     evaluate(...args: SonValue[]): SonValue;
// }

// Interface for Method implementations (to be defined later)
// export interface SonMethod {
//     type: 'method';
//     args: string[];
//     body: SonValue;
//     // Method to execute the method in a given context
//     execute(receiver: SonValue, args: SonValue[], env: ISonEnvironment): SonValue;
// }