/**
 * <ai_info>
 * This file contains the core evaluation logic for SON (Smalltalk Object Notation) JSON.
 * The `evaluate` function recursively traverses the SON Abstract Syntax Tree (AST) represented
 * as JSON, interpreting the different language constructs according to the specification.
 * It relies on the `SonEnvironment` for variable scoping and handles message sending,
 * assignments, cascades, and sequences. Block closures and returns will be added later.
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
 * - Handles assignment (`["var:", expr]`).
 * - Handles unary, binary, and keyword message sends.
 * - Handles cascades (`["receiver", "cascade:", [msgs]]`).
 * - Basic error handling (VariableNotFound, MessageNotUnderstood, ArgumentError).
 */

import { ISonEnvironment, SonValue, SonSymbol, SonArray, SonObject } from './types';
import { VariableNotFoundError, MessageNotUnderstoodError, ArgumentError, SonError } from './errors'; // Added SonError

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
 * @throws {ArgumentError} If the method exists but expects a different number of arguments (basic check).
 * @throws Any error thrown by the executed method.
 */
function lookupAndSend(receiver: any, selector: string, args: SonValue[], env: ISonEnvironment): SonValue {
    // TODO: This is a placeholder for real Smalltalk method lookup.
    // It currently only works for JS objects with matching methods.

    // Handle null/undefined receivers gracefully
    if (receiver === null || receiver === undefined) {
        // In Smalltalk, sending messages to nil often results in nil or an error.
        // Let's throw MessageNotUnderstood for consistency for now.
        throw new MessageNotUnderstoodError(receiver, selector);
    }

    // Basic JS property lookup
    // For keyword messages like "at:put:", this looks for a JS property named "at:put:"
    const method = (receiver as any)[selector];

    if (typeof method === 'function') {
        // Basic arity check for non-keyword messages might be useful
        // but unreliable for JS. Keyword checks are more robust based on selector parts.
        const selectorParts = selector.split(':').filter(part => part.length > 0);
        const expectedArgs = selectorParts.length;

        // Only perform arity check if it looks like a keyword message
        // or a simple unary/binary where we expect a specific number of args
        const isKeyword = selector.includes(':') && selector.endsWith(':');
        const isUnary = !selector.includes(':') && args.length === 0;
        const isBinary = !selector.includes(':') && args.length === 1; // Basic binary check

        if (isKeyword && expectedArgs !== args.length) {
             console.warn(`Arity mismatch for keyword selector #${selector}: expected ${expectedArgs}, got ${args.length} args.`);
             // Optionally throw:
             throw new ArgumentError(`Selector #${selector} expects ${expectedArgs} arguments, but received ${args.length}.`);
        }
        // Less strict check for unary/binary as JS function length is unreliable
        // if ((isUnary || isBinary) && method.length !== args.length && method.length !== 0) {
             // console.warn(`Possible arity mismatch for selector #${selector}: method expects ${method.length}, got ${args.length} args.`);
        // }


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
             // Allow access to $env for introspection if needed? TBD. Let's allow it for now.
             if (varName === 'env') return env;

            try {
                 return env.get(varName);
            } catch (e) {
                 if (e instanceof VariableNotFoundError) {
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
        // Return the symbol object itself for now.
        return node;
    }

    // 2. Handle Arrays (Sequences, Message Sends, Special Forms)
    if (Array.isArray(node)) {
        const sonArray = node as SonArray;
        if (sonArray.length === 0) {
            return null; // Empty sequence evaluates to null.
        }

        const first = sonArray[0];
        const second = sonArray[1];

        // --- Special Forms and Constructs ---

        // Assignment: ["var:", expr]
        if (sonArray.length === 2 && typeof first === 'string' && first.endsWith(':') && first.length > 1) {
            // Exclude specific keywords that use colon notation but aren't assignments
            if (first !== 'cascade:' && first !== '=>:') { // Add other special forms here if needed
                const varName = first.slice(0, -1); // Remove trailing ':'
                console.debug(`Assignment: ${varName} := ${JSON.stringify(sonArray[1])}`);
                const value = evaluate(sonArray[1], env);
                env.set(varName, value);
                return value; // Assignment returns the assigned value
            }
        }

        // Cascade: ["receiver", "cascade:", [msg1, msg2, ...]]
        if (sonArray.length === 3 && second === 'cascade:' && Array.isArray(sonArray[2])) {
            const receiverNode = first;
            const messages = sonArray[2] as SonArray[];
            console.debug(`Cascade: ${JSON.stringify(receiverNode)} cascade: ${JSON.stringify(messages)}`);

            const receiver = evaluate(receiverNode, env);
            if (messages.length === 0) {
                return receiver; // Empty cascade returns receiver
            }

            for (const msg of messages) {
                if (!Array.isArray(msg) || msg.length === 0) {
                    throw new ArgumentError("Invalid message format within cascade.");
                }
                // Construct the full message send array [receiver, selector, ...args]
                const messageToSend: SonArray = [receiver, ...msg]; // Prepend receiver (already evaluated)
                console.debug(`Cascade message: ${JSON.stringify(messageToSend)}`);

                 // Evaluate the cascaded message, but discard the result
                 // Need a way to evaluate message sends directly without re-evaluating the receiver
                 // Let's refine this: evaluate needs to handle pre-evaluated receivers.
                 // For now, we re-evaluate parts, which is incorrect for cascades.

                 // --- Refined Cascade Logic ---
                 // Evaluate each message with the *same* receiver
                 const selector = msg[0];
                 const argNodes = msg.slice(1);

                 if (typeof selector !== 'string') {
                     throw new ArgumentError(`Invalid selector in cascade message: ${JSON.stringify(selector)}`);
                 }

                 const args = argNodes.map(argNode => evaluate(argNode, env));
                 lookupAndSend(receiver, selector, args, env); // Call lookupAndSend directly

                 // --- End Refined Cascade Logic ---

            }
            return receiver; // Cascade returns the original receiver
        }

        // Block Closure: [["args"], "=>:", [body...]]
        // Placeholder for Step 17

        // Return Statement: ["^", expr]
        // Placeholder for Step 17

        // Method Definition: ["define:args:body:", selector, ["args"], [body...]]
        // Placeholder for Step 17


        // --- Message Sends (after checking special forms) ---

        // Evaluate the receiver first (common to all sends)
        const receiver = evaluate(first, env);

        // Keyword Send: [receiver, "selector:with:", arg1, arg2] (selector must be string ending ':')
        // Requires length >= 3 and second element is a string containing ':'
        if (sonArray.length >= 3 && typeof second === 'string' && second.includes(':')) {
             const selector = second;
             const argNodes = sonArray.slice(2);
             console.debug(`Keyword Send: ${JSON.stringify(first)} >> ${selector} args: ${JSON.stringify(argNodes)}`);

             // Evaluate arguments
             const args = argNodes.map(argNode => evaluate(argNode, env));

             // Validate argument count against selector parts
             const selectorParts = selector.split(':').filter(part => part.length > 0);
             if (selector.endsWith(':') && selectorParts.length !== args.length) {
                 throw new ArgumentError(`Keyword selector #${selector} expects ${selectorParts.length} arguments, but received ${args.length}.`);
             }
             // If selector doesn't end with ':', it's technically invalid Smalltalk keyword syntax
             if (!selector.endsWith(':')) {
                console.warn(`Potentially malformed keyword selector (doesn't end with :): ${selector}`);
                // Proceed anyway for flexibility? Or throw? Let's throw for stricter adherence.
                throw new ArgumentError(`Malformed keyword selector (must end with ':'): ${selector}`);
             }

             return lookupAndSend(receiver, selector, args, env);
        }

        // Binary Send: [receiver, operator, argument] (operator must be string, not containing ':')
        // Requires length === 3 and second element is a string without ':'
        if (sonArray.length === 3 && typeof second === 'string' && !second.includes(':')) {
            const operator = second;
            const argumentNode = sonArray[2];
            console.debug(`Binary Send: ${JSON.stringify(first)} ${operator} ${JSON.stringify(argumentNode)}`);
            const argument = evaluate(argumentNode, env);
            return lookupAndSend(receiver, operator, [argument], env);
        }

        // Unary Send: [receiver, selector] (selector must be string, not containing ':')
        // Requires length === 2 and second element is a string without ':'
        if (sonArray.length === 2 && typeof second === 'string' && !second.includes(':')) {
            const selector = second;
            console.debug(`Unary Send: ${JSON.stringify(first)} >> ${selector}`);
            return lookupAndSend(receiver, selector, [], env);
        }

        // --- Default to Sequence ---
        // If it's an array and doesn't match known patterns above, treat as a sequence.
        // Note: Receiver was already evaluated above for potential message sends.
        // If it's truly a sequence, the first element should just be evaluated normally.
        // We need to re-evaluate the first element *as part of the sequence* if no message send pattern matched.

        console.debug(`Sequence: ${JSON.stringify(sonArray)}`);
        // Re-evaluate the first element since it wasn't used as a receiver in a matched send pattern
        let lastResult: SonValue = receiver; // Start with the evaluated first element
        for (let i = 1; i < sonArray.length; i++) {
            // TODO: Handle non-local returns propagating through sequences later (Step 17).
            lastResult = evaluate(sonArray[i], env);
        }
        return lastResult; // Return the result of the last statement
    }

    // 3. Handle Objects (excluding Symbols already handled)
    if (typeof node === 'object' && node !== null) {
        // Plain JSON object - return as is for now.
        return node as SonObject;
    }

    // Should not be reachable if SonValue covers all JSON types
    console.error("Evaluation failed for node:", JSON.stringify(node));
    throw new Error(`Unknown or unhandled SON node type/structure: ${Object.prototype.toString.call(node)}`);
}