/**
 * <ai_info>
 * This file defines custom error classes used by the SON interpreter.
 * These specific error types allow for more granular error handling and reporting
 * compared to using generic `Error` objects.
 * </ai_info>
 *
 * @file client/src/lib/son/errors.ts
 * @description Custom error classes for the SON interpreter runtime.
 */

/**
 * Base class for all custom errors originating from the SON interpreter.
 */
export class SonError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SonError';
        // Maintains proper stack trace in V8 environments (Node, Chrome)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SonError);
        }
    }
}

/**
 * Error thrown when a variable lookup fails (variable not found in any scope).
 */
export class VariableNotFoundError extends SonError {
    public variableName: string;

    constructor(variableName: string) {
        super(`Variable not found: ${variableName}`);
        this.name = 'VariableNotFoundError';
        this.variableName = variableName;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, VariableNotFoundError);
        }
    }
}

/**
 * Error thrown when an object does not understand a message (method lookup fails).
 */
export class MessageNotUnderstoodError extends SonError {
    public receiver: any; // Type might become more specific later
    public selector: string;

    constructor(receiver: any, selector: string) {
        // Attempt to provide a better string representation of the receiver
        let receiverStr = 'object';
        try {
            if (receiver === null) receiverStr = 'null';
            else if (typeof receiver === 'object') receiverStr = receiver.constructor?.name ?? JSON.stringify(receiver).substring(0, 50) + '...';
            else receiverStr = String(receiver);
        } catch (e) { /* Ignore errors during stringification */ }

        super(`Message not understood: ${receiverStr} does not understand #${selector}`);
        this.name = 'MessageNotUnderstoodError';
        this.receiver = receiver; // Store the actual receiver for potential debugging
        this.selector = selector;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MessageNotUnderstoodError);
        }
    }
}

/**
 * Error thrown when a message is sent with the wrong number or type of arguments.
 */
export class ArgumentError extends SonError {
    constructor(message: string) {
        super(`Argument error: ${message}`);
        this.name = 'ArgumentError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ArgumentError);
        }
    }
}

/**
 * Error used internally to signal a local return (`^ expr`) from a method context.
 * Should be caught by the method execution frame.
 */
export class LocalReturnError extends Error { // Not extending SonError as it's control flow
    public value: any;
    constructor(value: any) {
        super("Local return signal"); // Message not typically user-facing
        this.name = 'LocalReturnError';
        this.value = value;
        // No stack trace capture needed for control flow exceptions ideally
    }
}

/**
 * Error used internally to signal a non-local return (`^ expr`) from a block context.
 * Should be caught by the defining method's execution frame.
 */
export class NonLocalReturnError extends Error { // Not extending SonError as it's control flow
    public value: any;
    // Could potentially add target context identifier later if needed
    constructor(value: any) {
        super("Non-local return signal"); // Message not typically user-facing
        this.name = 'NonLocalReturnError';
        this.value = value;
        // No stack trace capture needed for control flow exceptions ideally
    }
}