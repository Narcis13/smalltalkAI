/* <ai_info>
 * This file contains the core evaluation logic for SON (Smalltalk Object Notation) JSON.
 * The `evaluate` function recursively traverses the SON Abstract Syntax Tree (AST) represented
 * as JSON, interpreting the different language constructs according to the specification.
 * It now handles block closures (`=>:`), local and non-local returns (`^`), assignments,
 * cascades, sequences, message sends (including class-based lookup and implicit self-return),
 * primitive operations (e.g., `primitive:NumberAdd:`), and calls to the special `JSBridge`.
 * </ai_info>
 *
 * @file client/src/lib/son/interpreter.ts
 * @description Core evaluation logic for SON JSON, including primitives, JSBridge, and class-based method dispatch.
 *
 * Key features:
 * - Recursive `evaluate` function for SON nodes.
 * - Handles literals, symbols, variables.
 * - Handles sequences, assignment, cascades.
 * - Handles block closure definition (`=>:`) capturing lexical scope and home context.
 * - Handles return statements (`^`) throwing `LocalReturnError` or `NonLocalReturnError`.
 * - Handles primitive calls (`primitive:...`).
 * - Handles special calls to the `JSBridge` object for JS interop.
 * - Enhanced `sendMessage` function:
 *    - Checks for JSBridge first.
 *    - Determines receiver's SON class using `getClassOf`.
 *    - Looks up SON methods using `lookupMethodLocally` on the class object.
 *    - Executes found SON methods with correct context and return handling.
 *    - Handles block execution (`value:`, `value:value:`, etc.).
 *    - Falls back to basic JS property lookup (deprecated in favor of JSBridge/Primitives).
 * - Includes error handling and propagation for returns.
 */

import {
    ISonEnvironment,
    SonValue,
    SonSymbol,
    SonArray,
    SonObject,
    SonBlock,
    SonMethodImplementation,
} from './types';
import {
    VariableNotFoundError,
    MessageNotUnderstoodError,
    ArgumentError,
    SonError,
    LocalReturnError,
    NonLocalReturnError,
} from './errors';
import { SonEnvironment } from './environment'; // Import SonEnvironment for instanceof checks if needed


// --- Type Guards ---

/** Checks if a value is a SON symbol literal. */
function isSonSymbol(value: any): value is SonSymbol {
    return typeof value === 'object' && value !== null && '#' in value && typeof value['#'] === 'string';
}

/** Checks if a value is a SON block closure object. */
function isSonBlock(value: any): value is SonBlock {
    return typeof value === 'object' && value !== null && value.__type === 'SonBlock';
}

/** Checks if a value is the special JSBridge object. */
function isJsBridge(value: any): value is { __isJSBridge: true; [key: string]: any } {
    return typeof value === 'object' && value !== null && value.__isJSBridge === true;
}

/** Checks if a value is likely a plain JSON object (not a Symbol, Block, or JSBridge). */
function isPlainObject(value: any): value is { [key: string]: SonValue } {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !isSonSymbol(value) && !isSonBlock(value) && !isJsBridge(value);
}

// --- Helper Functions ---

/**
 * Finds the environment corresponding to the method context in which a block was defined.
 * Traverses the parent chain from the block's lexical scope.
 * @param startEnv The initial environment (usually the block's lexical scope).
 * @returns The home method context environment, or null if the block was not defined within a method context.
 */
function findHomeContext(startEnv: ISonEnvironment): ISonEnvironment | null {
    let current: ISonEnvironment | null = startEnv;
    while (current) {
        if (current.isMethodContext()) {
            return current;
        }
        current = current.getParent();
    }
    // It's valid for a block to be defined outside a method context (e.g., top level script)
    return null;
}

/**
 * Determines the SON "Class" object for a given JavaScript runtime value.
 * Looks up the class name (e.g., 'Number', 'String', 'BlockClosure') in the environment.
 *
 * @param value The JavaScript value whose class is needed.
 * @param env The current environment, used to look up class objects like 'Number'.
 * @returns The corresponding SON Class object (expected to conform to ISonEnvironment or have methods) or null if no class found.
 * @throws {Error} If the environment itself is missing a required base class (e.g., 'Object').
 */
function getClassOf(value: SonValue, env: ISonEnvironment): ISonEnvironment | SonObject | null {
    let className: string | null = null;

    if (value === null) {
        // Represent null using a specific class, e.g., 'UndefinedObject' or 'Null' if defined
        className = 'UndefinedObject'; // Assuming this class exists in base env
    } else if (typeof value === 'number') {
        className = 'Number';
    } else if (typeof value === 'string') {
        // Check if it's a variable string first (though evaluate should handle this)
        if (value.startsWith('$')) {
            // Corrected console.warn line:
            console.warn(`getClassOf received unevaluated variable string: ${value}`);
            // Attempt to evaluate it - this might be redundant if evaluate works correctly
            try {
                const evaluatedValue = evaluate(value, env);
                return getClassOf(evaluatedValue, env); // Recurse with the evaluated value
            } catch (e) {
                 console.error(`Error evaluating potential variable ${value} in getClassOf`, e);
                 className = 'String'; // Fallback to String if evaluation fails
            }
        } else {
           className = 'String';
        }
    } else if (typeof value === 'boolean') {
        className = 'Boolean';
    } else if (isSonSymbol(value)) {
        className = 'Symbol';
    } else if (isSonBlock(value)) {
        className = 'BlockClosure';
    } else if (isJsBridge(value)) {
        // The JSBridge is special, doesn't really have a SON class representation
        // Messages are handled directly. Return null to prevent standard lookup.
        return null;
    } else if (value instanceof SonEnvironment) {
         // If the value is an environment itself (e.g., a class object), its "class" is complex.
         // Maybe 'Metaclass'? For now, let's treat it like 'Object' for method lookup purposes,
         // assuming methods are defined *on* the environment instance.
         // Alternatively, message sends directly to environments could be handled specially.
         // Let's try returning the environment itself as the 'class' object
         // This allows sending messages like `$Number defineMethod:...` if needed.
         return value;

    } else if (typeof value === 'object') {
        // Default for other objects
        className = 'Object';
    }

    if (className) {
        try {
            // Look up the class object in the environment
            const classObj = env.get(className);
            // We expect the class object to conform to ISonEnvironment or be a plain object with methods
            if (typeof classObj === 'object' && classObj !== null) {
                 // Check if it's an environment (which implements lookupMethodLocally)
                 if (classObj instanceof SonEnvironment || (typeof (classObj as any).lookupMethodLocally === 'function')) {
                     return classObj as ISonEnvironment;
                 }
                 // Check if it's a plain object structure from base env (with a 'methods' property)
                 if (isPlainObject(classObj) && (classObj as any).methods) {
                     return classObj as SonObject; // Return the plain object structure
                 }
            }
            console.warn(`Class object for '${className}' not found or not a valid object/environment structure in env.`);
            // Fallback to Object class if primary class lookup fails?
            if (className !== 'Object') {
                 console.warn(`Falling back to 'Object' class lookup for value of type '${className}'.`);
                 return getClassOf({}, env); // Get the Object class definition
            }
            return null; // Class definition not found or invalid

        } catch (e) {
            if (e instanceof VariableNotFoundError) {
                 // This is critical if base classes like 'Object' are missing.
                 console.error(`Core class '${className}' not found in environment! Base environment might be incomplete.`);
                 if (className === 'Object') throw new Error("Critical Error: SON 'Object' class definition missing from environment.");
                 // Try falling back to Object if a specific class is missing
                 if (className !== 'Object') {
                     console.warn(`Falling back to 'Object' class lookup because '${className}' was not found.`);
                     return getClassOf({}, env); // Get the Object class definition
                 }
                 return null; // Class not found
            } else {
                throw e; // Re-throw other errors during lookup
            }
        }
    }

    console.warn(`Could not determine SON class for value:`, value);
    // If absolutely no class found, default to Object class definition
    try {
        return getClassOf({}, env);
    } catch (fallbackError) {
         console.error("Failed even to get the 'Object' class definition during fallback.", fallbackError);
         throw new Error("Critical error: Could not determine class for value and 'Object' class is missing.");
    }
}


/**
 * Handles message sending for basic JavaScript property lookup (used as a last resort).
 * DEPRECATED: Prefer using primitives or the JSBridge for JS interop.
 *
 * @param receiver The evaluated receiver object.
 * @param selector The message selector string.
 * @param args The evaluated arguments array.
 * @returns The result of the JS property access/call.
 * @throws {MessageNotUnderstoodError} If the property doesn't exist or isn't appropriate.
 */
function lookupAndSendJSProperty(receiver: any, selector: string, args: SonValue[]): SonValue {
    console.warn(`Attempting fallback JS property lookup for #${selector} on:`, receiver); // Log fallback usage

    if (receiver === null || receiver === undefined) {
        // Allow fallback lookup on UndefinedObject class instead of throwing here?
         const classObject = getClassOf(receiver, /* Need env here! */); // Problem: Env not available directly
         if (classObject) {
              // Re-try sendMessage on the class object? This gets recursive quickly.
              // Let's stick to throwing for now. Proper handling requires UndefinedObject class.
         }
        throw new MessageNotUnderstoodError(receiver, selector);
    }

    // Simple property access for unary sends
    if (args.length === 0 && selector in receiver) {
         const property = (receiver as any)[selector];
         // Don't call functions automatically on unary access
         return property;
    }

    // Simple property assignment for keyword sends like 'x:'
     if (args.length === 1 && selector.endsWith(':')) {
         const setterProperty = selector.slice(0, -1); // remove trailing ':'
         // Check if property exists OR if it's a plain JS object we can add to
         if (setterProperty in receiver || (typeof receiver === 'object' && !(receiver instanceof SonEnvironment) && !isSonBlock(receiver) && !isSonSymbol(receiver) && !isJsBridge(receiver))) {
              try {
                (receiver as any)[setterProperty] = args[0];
                return args[0]; // Assignment returns the assigned value
              } catch (e: any) {
                  console.error(`Error during fallback JS property assignment for #${selector}:`, e);
                  throw new SonError(`Failed to set JS property ${setterProperty}: ${e.message}`);
              }
         }
    }

    // If none of the above matched, the message is not understood via fallback property access/assignment.
    throw new MessageNotUnderstoodError(receiver, selector);
}

/**
 * Executes primitive operations identified by selectors like "primitive:NumberAdd:".
 *
 * @param primitiveSelector The full primitive selector string.
 * @param evaluatedReceiver The evaluated receiver (`self`).
 * @param evaluatedArgs An array containing the already evaluated arguments (excluding self) for the primitive.
 * @param env The current environment (potentially useful for future primitives).
 * @returns The result of the primitive operation.
 * @throws {ArgumentError} If the wrong number or type of arguments are provided.
 * @throws {SonError} If the primitive selector is unknown or an error occurs (e.g., division by zero).
 */
function handlePrimitive(primitiveSelector: string, evaluatedReceiver: SonValue, evaluatedArgs: SonValue[], env: ISonEnvironment): SonValue {
    console.debug(`Handling primitive: ${primitiveSelector} on receiver:`, evaluatedReceiver, `with args:`, evaluatedArgs);

    const self = evaluatedReceiver;
    const arg1 = evaluatedArgs.length > 0 ? evaluatedArgs[0] : undefined;
    const arg2 = evaluatedArgs.length > 1 ? evaluatedArgs[1] : undefined;

    // Helper for type checking arguments (including self)
    type ArgType = 'number' | 'string' | 'boolean' | 'object' | 'symbol' | 'block' | 'any' | null; // Added null type
    const checkArgs = (types: ArgType[]) => {
        const actualArgs = [self, ...evaluatedArgs];
        if (types.length !== actualArgs.length) {
             throw new ArgumentError(`Primitive ${primitiveSelector} expects ${types.length} arguments (including self), got ${actualArgs.length}`);
        }
        for(let i=0; i < types.length; i++) {
             const expectedType = types[i];
             const actualValue = actualArgs[i];
             let actualType = typeof actualValue;
             if (actualValue === null) actualType = null; // Special case null
             else if (isSonSymbol(actualValue)) actualType = 'symbol';
             else if (isSonBlock(actualValue)) actualType = 'block';

             if (expectedType === 'any' || expectedType === actualType) continue;

             // Allow null if 'object' is expected
             if (expectedType === 'object' && actualType === null) continue;

             throw new ArgumentError(`Primitive ${primitiveSelector} argument ${i} must be type ${expectedType}, got ${actualType}`);
        }
    };

    switch (primitiveSelector) {
        // --- Number Primitives ---
        case "primitive:NumberAdd:":         checkArgs(['number', 'number']); return (self as number) + (arg1 as number);
        case "primitive:NumberSubtract:":    checkArgs(['number', 'number']); return (self as number) - (arg1 as number);
        case "primitive:NumberMultiply:":    checkArgs(['number', 'number']); return (self as number) * (arg1 as number);
        case "primitive:NumberDivide:":
            checkArgs(['number', 'number']);
            if (arg1 === 0) throw new SonError("Division by zero");
            return (self as number) / (arg1 as number);
        case "primitive:NumberLessThan:":        checkArgs(['number', 'number']); return (self as number) < (arg1 as number);
        case "primitive:NumberGreaterThan:":     checkArgs(['number', 'number']); return (self as number) > (arg1 as number);
        case "primitive:NumberLessOrEqual:":     checkArgs(['number', 'number']); return (self as number) <= (arg1 as number);
        case "primitive:NumberGreaterOrEqual:":  checkArgs(['number', 'number']); return (self as number) >= (arg1 as number);
        case "primitive:NumberEquals:":
             checkArgs(['number', 'number']);
             return self === arg1;
        case "primitive:NumberToString:": checkArgs(['number']); return String(self);


        // --- Object Primitives ---
        case "primitive:Equals:": // Basic JS equality (===)
             checkArgs(['any', 'any']);
             return self === arg1;
        case "primitive:NotEquals:": // Basic JS inequality (!==)
             checkArgs(['any', 'any']);
             return self !== arg1;
        case "primitive:IdentityEquals:": // JS identity (===)
             checkArgs(['any', 'any']);
             return self === arg1;
        case "primitive:IdentityNotEquals:": // JS identity (!==)
             checkArgs(['any', 'any']);
             return self !== arg1;
        case "primitive:Class:": // Get the class object itself
             checkArgs(['any']);
             return getClassOf(self, env); // Return the class object found by getClassOf
        case "primitive:PrintString:": // Generic printString (subclass responsibility ideally)
             checkArgs(['any']);
             if (self === null) return "nil";
             if (isSonSymbol(self)) return `#${self['#']}`;
             if (isSonBlock(self)) return `a BlockClosure`;
             try { return String(self); } catch { return `an Object`; }


        // --- Boolean Primitives ---
         case "primitive:BooleanAnd:": checkArgs(['boolean', 'boolean']); return (self as boolean) && (arg1 as boolean);
         case "primitive:BooleanOr:": checkArgs(['boolean', 'boolean']); return (self as boolean) || (arg1 as boolean);
         case "primitive:BooleanNot": checkArgs(['boolean']); return !(self as boolean);
         case "primitive:BooleanIfTrue:":
              checkArgs(['boolean', 'block']); // Expect block closure as arg1
              if (self === true) {
                  // Evaluate the block (value:)
                  return sendMessage(arg1 as SonBlock, 'value', [], env);
              }
              return null; // Return null if condition is false
         case "primitive:BooleanIfFalse:":
              checkArgs(['boolean', 'block']);
              if (self === false) {
                  return sendMessage(arg1 as SonBlock, 'value', [], env);
              }
              return null;
        case "primitive:BooleanIfTrueIfFalse:":
             checkArgs(['boolean', 'block', 'block']); // Expect two blocks
             const blockToRun = self === true ? arg1 : arg2;
             return sendMessage(blockToRun as SonBlock, 'value', [], env);
         case "primitive:BooleanToString:": checkArgs(['boolean']); return String(self);


        // --- String Primitives ---
        case "primitive:StringConcatenate:": checkArgs(['string', 'string']); return (self as string) + (arg1 as string);
        case "primitive:StringLength": checkArgs(['string']); return (self as string).length;
        case "primitive:StringEquals:": checkArgs(['string','string']); return self === arg1;


         // --- Symbol Primitives ---
         case "primitive:SymbolToString:": checkArgs(['symbol']); return `#${(self as SonSymbol)['#']}`;
         case "primitive:SymbolEquals:": checkArgs(['symbol','symbol']); return (self as SonSymbol)['#'] === (arg1 as SonSymbol)['#'];


         // --- UndefinedObject (Null) Primitives ---
          case "primitive:NilIfNil:": checkArgs([null, 'block']); return sendMessage(arg1 as SonBlock, 'value', [], env);
          case "primitive:NilIfNotNil:": checkArgs([null, 'block']); return null; // Do nothing if nil
          case "primitive:NilIfNilIfNotNil:": checkArgs([null, 'block', 'block']); return sendMessage(arg1 as SonBlock, 'value', [], env);


        // --- Add other primitives here (Array etc.) ---

        default:
            throw new SonError(`Unknown primitive selector: ${primitiveSelector}`);
    }
}


/**
 * Central function for sending a message (selector + arguments) to a receiver.
 * Dispatches to appropriate handlers: JSBridge, Primitives, SON Methods, Blocks, or JS Property Fallback.
 *
 * @param receiver The evaluated receiver value.
 * @param selector The message selector string.
 * @param args The evaluated arguments array.
 * @param env The current execution environment (used for creating method scopes).
 * @returns The result of the message send.
 * @throws {MessageNotUnderstoodError} If the receiver doesn't understand the message via any mechanism.
 * @throws {ArgumentError} If the message is sent with incorrect arguments (arity/type mismatch).
 * @throws {LocalReturnError | NonLocalReturnError} If the message execution triggers a return.
 */
function sendMessage(receiver: SonValue, selector: string, args: SonValue[], env: ISonEnvironment): SonValue {
    console.debug(`sendMessage: receiver=${JSON.stringify(receiver)?.substring(0,50)}, selector=#${selector}, args=${JSON.stringify(args)?.substring(0,100)}`);

    // 1. Handle JSBridge Calls
    if (isJsBridge(receiver)) {
        const bridgeFunction = receiver[selector];
        if (typeof bridgeFunction === 'function') {
             console.debug(`Calling JSBridge function #${selector}`);
             try {
                 return bridgeFunction.apply(receiver, args);
             } catch (e: any) {
                 console.error(`Error during JSBridge call #${selector}:`, e);
                 throw new SonError(`JSBridge Error in #${selector}: ${e.message}`);
             }
        } else {
            // If method not found directly on JSBridge object
            throw new MessageNotUnderstoodError(receiver, selector);
        }
    }

    // 2. Attempt SON Method/Primitive Lookup
    const classObject = getClassOf(receiver, env); // Find the receiver's class definition
    let methodImpl: SonMethodImplementation | null = null;
    let isPrimitive = false;
    let primitiveSelector = "";

    // Recursive method lookup helper (checks class hierarchy)
    const findMethodRecursively = (currentClassObject: ISonEnvironment | SonObject | null, targetSelector: string): { impl: SonMethodImplementation | null, primitive: string | null } => {
        if (!currentClassObject) return { impl: null, primitive: null };

        let rawMethodData: any = null;

        // Look up method definition on the current class object
        if (typeof (currentClassObject as any).lookupMethodLocally === 'function') {
            // If it's a SonEnvironment, use its lookup
            rawMethodData = (currentClassObject as ISonEnvironment).lookupMethodLocally(targetSelector);
        } else if (isPlainObject(currentClassObject) && (currentClassObject as any).methods) {
            // If it's a plain object from base env, look in its 'methods' map
            const methodsMap = (currentClassObject as any).methods as Record<string, any>;
            rawMethodData = methodsMap[targetSelector];
        }

        // Process the found method data
        if (rawMethodData) {
            // Check if it's a primitive marker
            if (typeof rawMethodData === 'object' && rawMethodData !== null && typeof rawMethodData.primitive === 'string') {
                return { impl: null, primitive: rawMethodData.primitive };
            }
            // Check if it's a standard method implementation structure
            else if (typeof rawMethodData === 'object' && rawMethodData !== null && Array.isArray(rawMethodData.argNames) && rawMethodData.body !== undefined) {
                return {
                    impl: {
                        __type: 'SonMethodImplementation',
                        argNames: rawMethodData.argNames.map(String),
                        body: rawMethodData.body,
                        selector: targetSelector
                    },
                    primitive: null
                };
            } else {
                 console.warn(`Invalid method structure found for ${targetSelector} in class:`, currentClassObject, " Data:", rawMethodData);
                 // Fall through to check superclass
            }
        }

        // If not found locally, check superclass (Object for now)
        // TODO: Implement proper superclass chain lookup when inheritance is defined
        if (currentClassObject !== env.get('Object') && className !== 'Object') { // Avoid infinite loop checking Object's superclass
             console.debug(`Method #${targetSelector} not found locally on ${typeof currentClassObject}, checking Object class...`);
             const objectClass = getClassOf({}, env); // Get Object class definition
             if (objectClass && objectClass !== currentClassObject) {
                  return findMethodRecursively(objectClass, targetSelector);
             }
        }

        // Not found anywhere in hierarchy
        return { impl: null, primitive: null };
    };

    // Start the recursive lookup
    const lookupResult = findMethodRecursively(classObject, selector);
    methodImpl = lookupResult.impl;
    if (lookupResult.primitive) {
        isPrimitive = true;
        primitiveSelector = lookupResult.primitive;
        console.debug(`Method #${selector} maps to primitive: ${primitiveSelector}`);
    }


    // 3. Execute Primitive if found
    if (isPrimitive) {
        return handlePrimitive(primitiveSelector, receiver, args, env);
    }

    // 4. Execute Found SON Method
    if (methodImpl) {
        console.debug(`Executing SON method #${selector} on`, receiver);
        const methodEnv = env.createChild({ isMethodContext: true, methodSelf: receiver });

        if (methodImpl.argNames.length !== args.length) {
            throw new ArgumentError(`Method #${selector} expects ${methodImpl.argNames.length} arguments, but received ${args.length}.`);
        }
        for (let i = 0; i < methodImpl.argNames.length; i++) {
            methodEnv.set(methodImpl.argNames[i], args[i]);
        }
        // console.debug("Method Env:", methodEnv.dumpScope ? methodEnv.dumpScope(0) : '<No dumpScope>');

        try {
             let methodResult: SonValue;
             if (!Array.isArray(methodImpl.body)) {
                 methodResult = evaluate(methodImpl.body, methodEnv);
             } else {
                 methodResult = null; // Default if body is empty array
                 for (let i = 0; i < methodImpl.body.length; i++) {
                    methodResult = evaluate(methodImpl.body[i], methodEnv);
                 }
             }
            // Implicit return of self if no explicit '^' was caught
            console.debug(`Method #${selector} finished implicit return.`);
            return receiver; // Return 'self'

        } catch (e) {
            if (e instanceof LocalReturnError || e instanceof NonLocalReturnError) {
                // Method context catches returns originating from its execution or nested blocks defined within it.
                console.debug(`Method #${selector} caught explicit return:`, e.value);
                return e.value; // Return the value from '^'
            } else {
                throw e; // Propagate other errors
            }
        }
    }

    // 5. Handle Block Execution (value:, value:value:, etc.)
    if (isSonBlock(receiver)) {
        if (selector.startsWith('value') && (selector === 'value' || selector.match(/^value:$/) || selector.match(/^value:(value:)+$/))) {
            const expectedArgs = selector === 'value' ? 0 : selector.split(':').length - 1;
            if (args.length !== expectedArgs) {
                throw new ArgumentError(`Block ${selector} expects ${expectedArgs} arguments, but received ${args.length}.`);
            }
            if (receiver.argNames.length !== args.length) {
                 throw new ArgumentError(`Block definition expected ${receiver.argNames.length} arguments, but received ${args.length} for ${selector}.`);
            }

            // Create env for block exec, inheriting from block's *captured* scope
            const blockEnv = receiver.lexicalScope.createChild();

            // Bind arguments
            for (let i = 0; i < receiver.argNames.length; i++) {
                blockEnv.set(receiver.argNames[i], args[i]);
            }

            console.debug("Executing block body in env:", blockEnv.dumpScope? blockEnv.dumpScope(0) : '<No dumpScope>');
            try {
                 let blockResult: SonValue = null;
                 if(!Array.isArray(receiver.body)) {
                    throw new Error("Invalid block body structure: expected an array.");
                 }
                 for (let i = 0; i < receiver.body.length; i++) {
                     blockResult = evaluate(receiver.body[i], blockEnv);
                 }
                 // Implicit return of last statement's value
                 return blockResult;

            } catch (e) {
                 if (e instanceof NonLocalReturnError) {
                    // Check if return targets the block's home context or one of its parents
                     let currentHome: ISonEnvironment | null = receiver.homeContext;
                     let targetMatch = false;
                     while(currentHome) {
                         if (e.homeContext === currentHome) {
                             targetMatch = true;
                             break;
                         }
                         currentHome = findHomeContext(currentHome.getParent()!); // Check parent method contexts? Risky. Stick to direct home context.
                     }

                     // Only propagate if the target is the immediate home context where the block was defined.
                     if (e.homeContext === receiver.homeContext && receiver.homeContext !== null) {
                         console.debug("Propagating non-local return from block:", e.value);
                         throw e;
                     } else if (receiver.homeContext === null) {
                          throw new SonError("Cannot perform non-local return (^) from block defined outside a method context.");
                     } else {
                          console.error("Non-local return error encountered with mismatched home context!", "Target:", e.homeContext, "Block Home:", receiver.homeContext);
                         // Allow propagation even if target is outer method? Smalltalk allows this.
                         // Let's allow propagation for now, caller method context will catch if it's the target.
                         console.warn("Propagating non-local return with potentially mismatched target context.");
                         throw e;
                         // throw new Error("Internal error: Non-local return target mismatch.");
                     }
                } else if (e instanceof LocalReturnError) {
                    throw new SonError("Cannot perform local return (^) from within a block context. Use non-local return targeting the defining method.");
                } else {
                    throw e; // Re-throw other errors
                }
            }
        } else {
             // If it's a block but selector isn't value*, try looking up on BlockClosure class
             console.debug(`Block received #${selector}, looking up on BlockClosure class...`);
             const blockClass = getClassOf(receiver, env);
             if (blockClass) {
                  const blockLookupResult = findMethodRecursively(blockClass, selector);
                  if (blockLookupResult.primitive) {
                       return handlePrimitive(blockLookupResult.primitive, receiver, args, env);
                  } else if (blockLookupResult.impl) {
                       // Re-enter sendMessage logic to execute the method found on BlockClosure
                       // Need to ensure 'self' is the block instance.
                       methodImpl = blockLookupResult.impl; // Found method on BlockClosure class
                       // Jump to method execution logic (duplicated slightly, could refactor)
                       console.debug(`Executing BlockClosure method #${selector} on`, receiver);
                       const methodEnv = env.createChild({ isMethodContext: true, methodSelf: receiver }); // Self is the block
                       if (methodImpl.argNames.length !== args.length) {
                           throw new ArgumentError(`Method #${selector} expects ${methodImpl.argNames.length} arguments, but received ${args.length}.`);
                       }
                       for (let i = 0; i < methodImpl.argNames.length; i++) { methodEnv.set(methodImpl.argNames[i], args[i]); }
                       try {
                            let methodResult: SonValue = null;
                            if (!Array.isArray(methodImpl.body)) { methodResult = evaluate(methodImpl.body, methodEnv); }
                            else { for (let i = 0; i < methodImpl.body.length; i++) { methodResult = evaluate(methodImpl.body[i], methodEnv); } }
                            return receiver; // Method on block returns self (the block)
                       } catch (e) {
                           if (e instanceof LocalReturnError || e instanceof NonLocalReturnError) { return e.value; } else { throw e; }
                       }
                  }
             }
             // If no method found on BlockClosure class
             throw new MessageNotUnderstoodError(receiver, selector);
        }
    }

    // 6. Last Resort: Fallback to JavaScript Property Access (DEPRECATED)
    console.warn(`No SON method/primitive/block execution for #${selector}, attempting deprecated JS property fallback...`);
    try {
        // Pass env to fallback for potential class lookup on null/undefined
        return lookupAndSendJSProperty(receiver, selector, args);
    } catch (e) {
        if (e instanceof MessageNotUnderstoodError) {
            console.error(`Message #${selector} not understood by receiver (SON/Block/JS/Primitive/Fallback):`, receiver);
            let receiverType = typeof receiver;
             if (receiver === null) receiverType = 'null';
             else if (isSonSymbol(receiver)) receiverType = 'Symbol';
             else if (isSonBlock(receiver)) receiverType = 'BlockClosure';
             else if (receiver instanceof SonEnvironment) receiverType = 'SonEnvironment';
             else if (isJsBridge(receiver)) receiverType = 'JSBridge';
            // Throw a more specific MNU Error
            throw new MessageNotUnderstoodError(receiver, selector);
        } else {
            throw e; // Propagate other errors
        }
    }
}


// --- Core Evaluation Function ---

/**
 * Evaluates a SON node within a given environment.
 *
 * @param node The SON node (JSON value) to evaluate.
 * @param env The current execution environment (provides scope).
 * @returns The result of evaluating the node.
 * @throws {SonError} Or subclasses for runtime errors.
 * @throws {LocalReturnError | NonLocalReturnError} For control flow.
 * @throws {Error} For syntax errors or unexpected issues.
 */
export function evaluate(node: SonValue, env: ISonEnvironment): SonValue {

    // 1. Handle Literals and Variables
    if (typeof node === 'number' || typeof node === 'boolean' || node === null) {
        return node;
    }
    if (typeof node === 'string') {
        if (node.startsWith('$')) {
            const varName = node.substring(1);
            if (!varName) throw new Error("Invalid variable name: '$'");
            if (varName === 'env') return env; // Allow introspection
            try {
                 return env.get(varName);
            } catch (e) {
                 if (e instanceof VariableNotFoundError) {
                      console.error(`Variable lookup failed: ${e.message}`);
                      console.error("Current environment scope:", env.dumpScope? env.dumpScope(2): '<No dumpScope>'); // Log env state on error
                 }
                 throw e; // Re-throw
            }
        }
        return node; // String literal
    }
    if (isSonSymbol(node)) {
        return node; // Return symbol object
    }
    if (isSonBlock(node)) {
         // If a block itself is evaluated (e.g. just `[[]=>:[]]`), return it.
         return node;
    }
    if (isJsBridge(node)) {
        // If the bridge object itself is evaluated, return it
        return node;
    }


    // 2. Handle Arrays (Special Forms, Sequences, Message Sends)
    if (Array.isArray(node)) {
        const sonArray = node as SonArray;
        if (sonArray.length === 0) {
            return null; // Empty sequence evaluates to null
        }

        const first = sonArray[0];

        // --- Special Forms ---

        // Return Statement: ["^", expr]
        if (first === '^') {
            if (sonArray.length !== 2) {
                throw new ArgumentError("Return statement ('^') requires exactly one argument.");
            }
            const value = evaluate(sonArray[1], env);
            const homeCtx = findHomeContext(env); // Find defining method context

            if (!homeCtx && !env.isMethodContext()) {
                 throw new SonError("Cannot return ('^') from outside a method context.");
            }

            if (env.isMethodContext()) {
                 console.debug("Local return:", value);
                 throw new LocalReturnError(value);
            } else {
                 if (!homeCtx) { // Block defined outside method
                     throw new SonError("Cannot perform non-local return (^) from block defined outside a method context.");
                 }
                 console.debug("Non-local return:", value, "to context:", homeCtx);
                 throw new NonLocalReturnError(value, homeCtx);
            }
        }

        // Method Definition: ["define:args:body:", selector, ["argNames"], [body...]]
        if (first === 'define:args:body:') {
             if (sonArray.length !== 4) throw new ArgumentError("Method definition requires selector, args array, and body array.");
             const selector = sonArray[1];
             const argsNode = sonArray[2];
             const bodyNode = sonArray[3];
             if (typeof selector !== 'string') throw new ArgumentError("Method selector must be a string.");
             if (!Array.isArray(argsNode)) throw new ArgumentError("Method arguments must be an array of strings.");

             const argNames = argsNode.map(arg => {
                 if (typeof arg !== 'string') throw new ArgumentError("Method argument names must be strings.");
                 return arg;
             });

             if (typeof (env as any).defineMethod === 'function') {
                 (env as any).defineMethod(selector, argNames, bodyNode);
             } else {
                  // Maybe send a message to the env? ['$env', 'defineMethod:args:body:', ...]
                   return sendMessage(env, 'defineMethod:args:body:', [selector, argNames, bodyNode], env);
                 // throw new SonError("Cannot define method: Current environment does not support 'defineMethod'.");
             }
             return { '#': selector }; // Return selector symbol
        }


        // Assignment: ["var:", expr] - Simple assignment only (no colons in varName)
        if (sonArray.length === 2 && typeof first === 'string' && first.endsWith(':') && first.length > 1 && !first.slice(0,-1).includes(':')) {
            const varName = first.slice(0, -1);
             // Ensure it's not '^:' etc.
             if (varName !== '^') {
                 const value = evaluate(sonArray[1], env);
                 env.set(varName, value);
                 return value; // Assignment returns the assigned value
             }
             // If varName is '^', fall through to treat as message send.
        }

        // --- Evaluate First Element (for cascades, message sends, sequences) ---
        // This handles nested expressions like `[[1,"+",2], "*", 3]` correctly.
        // It also handles `[["arg"],"=>:",[]]` block definitions if they aren't the very first element.
        const evaluatedFirst = evaluate(first, env);
        const remainingNodes = sonArray.slice(1);

        // --- Block Definition Check ---
        // Structure: [argNodes, "=>:", body] after first element (argNodes) is evaluated
         if (remainingNodes.length === 2 && Array.isArray(evaluatedFirst) && remainingNodes[0] === '=>:' && Array.isArray(remainingNodes[1])) {
             const argNodes = evaluatedFirst as SonArray;
             const body = remainingNodes[1] as SonArray;
             const argNames = argNodes.map(argNode => {
                 if (typeof argNode !== 'string') throw new ArgumentError("Block argument names must be strings.");
                 return argNode;
             });
             const homeCtx = findHomeContext(env);
             const block: SonBlock = {
                 __type: 'SonBlock', argNames, body, lexicalScope: env, homeContext: homeCtx! // homeCtx can be null
             };
             console.debug("Created block closure (via evaluated first element):", block);
             return block;
         }


        // --- Cascade Check ---
        // Structure: [receiver, "cascade:", [msg1, msg2...]] after receiver evaluated
        if (remainingNodes.length === 2 && remainingNodes[0] === 'cascade:' && Array.isArray(remainingNodes[1])) {
            const receiver = evaluatedFirst;
            const messages = remainingNodes[1] as SonArray[];
            if (messages.length === 0) return receiver;

            for (const msg of messages) {
                 if (!Array.isArray(msg) || msg.length < 1) {
                     throw new ArgumentError("Invalid message format within cascade.");
                 }
                 const msgSelector = msg[0];
                 const msgArgNodes = msg.slice(1);
                 if (typeof msgSelector !== 'string') {
                     throw new ArgumentError(`Invalid selector in cascade message: ${JSON.stringify(msgSelector)}`);
                 }
                 const msgArgs = msgArgNodes.map(argNode => evaluate(argNode, env));
                 sendMessage(receiver, msgSelector, msgArgs, env); // Send message, discard result
            }
            return receiver; // Cascade returns the original receiver
        }

        // --- Message Send Check ---
        // Structure: [receiver, selector, arg1, arg2...] after receiver evaluated
        if (remainingNodes.length >= 1 && typeof remainingNodes[0] === 'string') {
            const selector = remainingNodes[0];
            const argNodes = remainingNodes.slice(1);

            // Check if it *could* be a message send (selector isn't 'cascade:' or '=>:')
            if (selector !== 'cascade:' && selector !== '=>:') {
                 // Keyword Send: selector contains ':'
                 if (selector.includes(':')) {
                      const args = argNodes.map(argNode => evaluate(argNode, env));
                      const expectedArgs = selector.split(':').filter(p => p.length > 0).length;
                      if (expectedArgs === args.length) { // Strict arity match for keyword send
                           return sendMessage(evaluatedFirst, selector, args, env);
                      } else {
                           // Arity mismatch for keyword send, fall through to sequence potentially? Or throw?
                           // Let's throw for keyword sends, ambiguity is high otherwise.
                           throw new ArgumentError(`Keyword selector #${selector} expects ${expectedArgs} arguments, got ${args.length}.`);
                      }
                 }
                 // Binary Send: selector has no ':', and there's exactly one argument node
                 else if (argNodes.length === 1) {
                     const args = [evaluate(argNodes[0], env)];
                     return sendMessage(evaluatedFirst, selector, args, env);
                 }
                 // Unary Send: selector has no ':', and there are no argument nodes
                 else if (argNodes.length === 0) {
                     return sendMessage(evaluatedFirst, selector, [], env);
                 }
            }
             // If it was cascade:/=>: or arity didn't match binary/unary/keyword, fall through to sequence.
        }


        // --- Default to Sequence ---
        console.debug(`Evaluating as Sequence: ${JSON.stringify(sonArray)}`);
        let lastResult: SonValue = evaluatedFirst; // Result starts with the already evaluated first element
        // Evaluate remaining elements
        for (let i = 0; i < remainingNodes.length; i++) {
             lastResult = evaluate(remainingNodes[i], env);
             // Note: Return errors propagate up naturally
        }
        return lastResult; // Return the result of the last statement
    }


    // 3. Handle Objects (if not Symbols, Blocks, Bridge already handled)
    if (typeof node === 'object' && node !== null) {
        // Plain JSON object - return as is. Messages handled by class lookup/JS fallback.
        return node as SonObject;
    }

    // Should not be reachable if SonValue covers all types and logic above is exhaustive
    console.error("Evaluation failed for node:", JSON.stringify(node));
    throw new Error(`Unknown or unhandled SON node type/structure: ${Object.prototype.toString.call(node)}`);
}