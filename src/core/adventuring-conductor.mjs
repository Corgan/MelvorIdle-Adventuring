export class AdventuringConductor {
    constructor(manager) {
        this.manager = manager;
        
        // Entity handlers: entity -> { handler, triggers }
        // triggers is null (all) or Set of trigger types
        this._entities = new Map();
        
        // Mutators: type -> Set of handlers
        // Called first, can modify context
        this._mutators = new Map();
        
        // Listeners: type -> Set of handlers
        // Called after mutators, observe only
        this._listeners = new Map();
    }

    /**
     * Register an entity (Character, Party) to receive triggers.
     * Entity handlers fire only when context.source === entity OR when no source (broadcast).
     * 
     * @param {object} entity - The entity instance
     * @param {function} handler - Function(type, context) to call
     * @param {string[]|null} triggers - Array of trigger types to listen for, or null for all
     */
    registerEntity(entity, handler, triggers = null) {
        const triggerSet = triggers ? new Set(triggers) : null;
        this._entities.set(entity, { handler, triggers: triggerSet });
    }

    /**
     * Register a mutator handler for specific trigger types.
     * Mutators are called first and may modify the context.
     * 
     * @param {string|string[]} types - Trigger type(s) to handle
     * @param {function} handler - Function(type, context) to call
     */
    register(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            if (!this._mutators.has(type)) {
                this._mutators.set(type, new Set());
            }
            this._mutators.get(type).add(handler);
        }
    }

    /**
     * Register a listener handler for specific trigger types.
     * Listeners are called after mutators and should not modify context.
     * 
     * @param {string|string[]} types - Trigger type(s) to listen for
     * @param {function} handler - Function(type, context) to call
     */
    listen(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            if (!this._listeners.has(type)) {
                this._listeners.set(type, new Set());
            }
            this._listeners.get(type).add(handler);
        }
    }

    /**
     * Unregister a mutator handler.
     * 
     * @param {string|string[]} types - Trigger type(s) to unregister from
     * @param {function} handler - The handler function to remove
     */
    unregister(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            const handlers = this._mutators.get(type);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this._mutators.delete(type);
                }
            }
        }
    }

    /**
     * Unregister a listener handler.
     * 
     * @param {string|string[]} types - Trigger type(s) to unregister from
     * @param {function} handler - The handler function to remove
     */
    unlisten(types, handler) {
        const typeArray = Array.isArray(types) ? types : [types];
        for (const type of typeArray) {
            const handlers = this._listeners.get(type);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this._listeners.delete(type);
                }
            }
        }
    }

    /**
     * Fire a trigger through the orchestration system.
     * 
     * Flow:
     * 1. Mutators for this type are called (can modify context)
     * 2. If context.source exists, only that entity's handler fires
     *    If no source, ALL registered entities fire (broadcast)
     * 3. Listeners for this type are called (includes '*' wildcard listeners)
     * 
     * @param {string} type - The trigger type
     * @param {object} context - Context object (will have `type` added)
     */
    trigger(type, context = {}) {
        // Add type to context
        context.type = type;

        // 1. Call mutators (can modify context)
        const mutators = this._mutators.get(type);
        if (mutators) {
            for (const handler of mutators) {
                try {
                    handler(type, context);
                } catch (e) {
                    console.error(`[Conductor] Mutator error for ${type}:`, e);
                }
            }
        }

        // 2. Call entity handlers
        if (context.source) {
            // Targeted: only fire for the source entity
            const registration = this._entities.get(context.source);
            if (registration) {
                const { handler, triggers } = registration;
                // Check if entity is listening for this trigger type
                if (triggers === null || triggers.has(type)) {
                    try {
                        handler(type, context);
                    } catch (e) {
                        console.error(`[Conductor] Entity handler error for ${type}:`, e);
                    }
                }
            }
        } else {
            // Broadcast: fire for ALL entities
            for (const [entity, registration] of this._entities) {
                const { handler, triggers } = registration;
                // Check if entity is listening for this trigger type
                if (triggers === null || triggers.has(type)) {
                    try {
                        handler(type, context);
                    } catch (e) {
                        console.error(`[Conductor] Entity handler error for ${type}:`, e);
                    }
                }
            }
        }

        // 3. Call listeners (observe only)
        // First, call type-specific listeners
        const listeners = this._listeners.get(type);
        if (listeners) {
            for (const handler of listeners) {
                try {
                    handler(type, context);
                } catch (e) {
                    console.error(`[Conductor] Listener error for ${type}:`, e);
                }
            }
        }
        
        // Then, call wildcard '*' listeners (receive all events)
        const wildcardListeners = this._listeners.get('*');
        if (wildcardListeners) {
            for (const handler of wildcardListeners) {
                try {
                    handler(type, context);
                } catch (e) {
                    console.error(`[Conductor] Wildcard listener error for ${type}:`, e);
                }
            }
        }
    }
}
