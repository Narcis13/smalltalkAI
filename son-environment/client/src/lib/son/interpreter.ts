/**
 * <ai_info>
 * This file contains the core evaluation logic for SON (Smalltalk Object Notation) JSON.
 * The `evaluate` function recursively traverses the SON Abstract Syntax Tree (AST) represented
 * as JSON, interpreting the different language constructs according to the specification.
 * It relies on the `SonEnvironment` for variable scoping and will later handle message sending,
 * block closures, and other features.
 * </ai_info>
 *
 * @file client/src/lib/son/interpreter.ts
 * @description Core evaluation logic for SON JSON.
 *
 * Key features:
 * - Recursive `evaluate` function for SON nodes.
 * - Handles literals (numbers, strings, booleans, null).
 * - Handles symbols (`{ "#": "name" }`).
 * - Handles variable lookup (`$varName`) via the environment.
 * - Handles sequences of statements (evaluates all, returns last).
 * - Handles basic unary and binary message sends (currently assumes JS methods on receiver).
 * - Basic error handling for variable not found and message not understood.
 */

import { ISonEnvironment, SonValue, SonSymbol, SonArray, SonObject } from './types';
import { VariableNotFoundError, MessageNotUnderstoodError, ArgumentError } from './errors';

// --- Helper Functions ---

/**
 * Checks if a value represents a SON symbol literal.
 * @param value The value to check.
 * @returns True if the value is a SonSymbol object, false otherwise.
 */
function isSonSymbol(value: any): value is SonSymbol {
    return typeof value === 'object' && value !== null && '#' in value && typeof value['#'] === 'string';
}

/**
 * Basic message lookup and sending.
 * Currently assumes the receiver is a JS object/primitive and looks for a
 * corresponding JS property (function) to call.
 * This will need significant extension to handle Smalltalk-style method lookup
 * on SON objects and classes later.
 *
 * @param receiver The evaluated receiver object.
 * @param selector The message selector string.
 * @param args The evaluated arguments array.
 * @param env The current execution environment (potentially needed for context).
 * @returns The result of the message send.
 * @throws {MessageNotUnderstoodError} If the receiver doesn't have a suitable method.
 * @throws {ArgumentError} If the method exists but expects a different number of arguments.
 * @throws Any error thrown by the executed method.
 */
function lookupAndSend(receiver: any, selector: string, args: SonValue[], env: ISonEnvironment): SonValue {
    // TODO: This is a placeholder for real Smalltalk method lookup.
    // It currently only works for JS objects with matching methods.

    // Handle null/undefined receivers gracefully
    if (receiver === null || receiver === undefined) {
        throw new MessageNotUnderstoodError(receiver, selector);
    }

    // Basic JS property lookup
    const method = (receiver as any)[selector];

    if (typeof method === 'function') {
        // Check arity (basic check, may not be reliable for all JS functions)
        // Keyword messages will need different handling here later.
        if (method.length !== args.length) {
            // Allow calling functions with 0 args even if method.length > 0 (e.g. native methods) - refine later?
             if (args.length !== 0 || method.length !== 0) {
                // Simple check: length mismatch, likely an error for basic unary/binary
                // Keyword sends will need specific checks based on selector parts
                console.warn(`Possible arity mismatch for selector #${selector}: method expects ${method.length}, got ${args.length} args.`);
                // Consider throwing ArgumentError for stricter checking, especially outside unary/binary
                // throw new ArgumentError(`Selector #${selector} expects ${method.length} arguments, but received ${args.length}.`);
             }
        }
        try {
            // Call the JS function, setting 'this' to the receiver
            return method.apply(receiver, args);
        } catch (e: any) {
            // Re-throw errors from the called method
            console.error(`Error during JS method execution for #${selector}:`, e);
            throw e; // Let the top-level execution handler catch this
        }
    } else {
        // Method not found as a direct JS property/function
        throw new MessageNotUnderstoodError(receiver, selector);
    }

    // TODO: Implement proper method lookup on SON objects/classes here.
    // This would involve:
    // 1. Determining the "class" of the receiver.
    // 2. Looking up the method implementation (likely SON code) in the class/superclass hierarchy.
    // 3. Creating a new execution context (environment) for the method call.
    // 4. Binding arguments to parameters in the new environment.
    // 5. Setting 'self' variable in the new environment.
    // 6. Evaluating the method body (SON code) in the new environment.
}


// --- Core Evaluation Function ---

/**
 * Evaluates a SON node within a given environment.
 *
 * @param node The SON node (JSON value) to evaluate.
 * @param env The current execution environment (provides scope).
 * @returns The result of evaluating the node.
 * @throws {SonError} Or subclasses for runtime errors (VariableNotFound, MessageNotUnderstood, etc.).
 * @throws {Error} For syntax errors or unexpected issues.
 */
export function evaluate(node: SonValue, env: ISonEnvironment): SonValue {
    // console.debug("Evaluating:", JSON.stringify(node), "in env:", env); // Very verbose debugging

    // 1. Handle Literals
    if (typeof node === 'number' || typeof node === 'boolean' || node === null) {
        return node;
    }

    if (typeof node === 'string') {
        // Check for Variable access
        if (node.startsWith('$')) {
            const varName = node.substring(1);
            if (!varName) {
                throw new Error("Invalid variable name: '$'");
            }
             if (varName === 'env') return env; // Special case? Or disallow? Let's disallow direct $env access for now. TBD.
            try {
                 return env.get(varName);
            } catch (e) {
                 if (e instanceof VariableNotFoundError) {
                     // Attach node info? Maybe not needed if stack trace is good.
                     console.error(`Error evaluating variable "${node}": ${e.message}`);
                 }
                 throw e; // Re-throw
            }
        }
        // Regular string literal
        return node;
    }

    // Check for Symbol Literal (after string check)
    if (isSonSymbol(node)) {
        // For now, return the symbol object itself.
        // Later, might intern symbols or use JS Symbol() if needed for identity.
        return node;
    }

    // 2. Handle Arrays (Sequences, Message Sends, Special Forms)
    if (Array.isArray(node)) {
        const sonArray = node as SonArray;
        if (sonArray.length === 0) {
            return null; // Empty sequence evaluates to null? Or error? Let's say null.
        }

        // --- Check for Message Send Patterns ---
        // TODO: Refine these checks to be more robust, especially differentiating from special forms

        // Unary Send: [receiver, selector] (selector must be string)
        if (sonArray.length === 2 && typeof sonArray[1] === 'string') {
            const receiverNode = sonArray[0];
            const selector = sonArray[1] as string;
            // Avoid interpreting special forms like assignment as unary sends yet
            if (!selector.endsWith(':')) { // Simple heuristic, assignments end with ':'
                 console.debug(`Unary Send: ${JSON.stringify(receiverNode)} >> ${selector}`);
                const receiver = evaluate(receiverNode, env);
                 // Currently uses basic JS property lookup
                return lookupAndSend(receiver, selector, [], env);
            }
        }

        // Binary Send: [receiver, operator, argument] (operator must be string)
        if (sonArray.length === 3 && typeof sonArray[1] === 'string') {
             // Avoid interpreting keyword sends or special forms like define:args:body: yet
             const potentialOperator = sonArray[1] as string;
             // Basic check: common binary operators don't contain ':'
             // and aren't keywords like 'cascade:' or '=>:'
             const isLikelyBinary = !potentialOperator.includes(':') && potentialOperator !== '=>:' && potentialOperator !== 'cascade:';

             if(isLikelyBinary) {
                const receiverNode = sonArray[0];
                const operator = potentialOperator;
                const argumentNode = sonArray[2];
                console.debug(`Binary Send: ${JSON.stringify(receiverNode)} ${operator} ${JSON.stringify(argumentNode)}`);
                const receiver = evaluate(receiverNode, env);
                const argument = evaluate(argumentNode, env);
                 // Currently uses basic JS property lookup
                return lookupAndSend(receiver, operator, [argument], env);
             }
        }

        // Keyword Send: [receiver, "selector:with:", arg1, arg2] (selector must be string ending ':')
        // Will be handled later in Step 16

        // Assignment: ["var:", expr]
        // Will be handled later in Step 16

        // Method Definition: ["define:args:body:", selector, ["args"], [body...]]
        // Will be handled later in Step 16

        // Block Closure: [["args"], "=>:", [body...]]
        // Will be handled later in Step 17

        // Return Statement: ["^", expr]
        // Will be handled later in Step 17

        // Cascades: ["receiver", "cascade:", [msg1, msg2, ...]]
        // Will be handled later in Step 16

        // --- Default to Sequence ---
        // If it's an array and doesn't match known patterns above, treat as a sequence.
        console.debug(`Sequence: ${JSON.stringify(sonArray)}`);
        let lastResult: SonValue = null; // Default result for empty or all-null sequence?
        for (let i = 0; i < sonArray.length; i++) {
            // TODO: Handle non-local returns propagating through sequences later.
            lastResult = evaluate(sonArray[i], env);
        }
        return lastResult;
    }

    // 3. Handle Objects (excluding Symbols already handled)
    if (typeof node === 'object' && node !== null) {
        // This is a plain JSON object. What does it mean in SON?
        // - Could be a record/struct like object -> return as is for now.
        // - Could be used for future SON object representations.
        // For now, just return the object itself. Message sends *to* these objects
        // will currently only work if they have matching JS functions as properties.
        return node as SonObject;
    }

    // Should not be reachable if SonValue covers all JSON types
    throw new Error(`Unknown SON node type or structure: ${JSON.stringify(node)}`);
}