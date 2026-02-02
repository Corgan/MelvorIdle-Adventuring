const { loadModule } = mod.getContext(import.meta);

const { evaluateCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');
const { filterEffects, resolveTargets } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { defaultEffectProcessor } = await loadModule('src/core/effects/effect-processor.mjs');

/**
 * Caches and manages effects from multiple sources with lazy rebuilding.
 */
export class EffectCache {
    constructor() {
        this.sources = new Map();
        this.dirtyFlags = new Map();
        this.cachedByTrigger = new Map();
        this.allEffectsCache = null;
        this.bonusCache = new Map();
        this.globalDirty = true;
        this._rebuilding = false;  // Recursion protection
    }

    /**
     * Register an effect source with optional callbacks.
     * @param {string} sourceId - Unique identifier for this source
     * @param {Function|Object} source - Either:
     *   - A function: () => Effect[]
     *   - An object: { getEffects, filters?, onTrigger? }
     */
    registerSource(sourceId, source) {
        if (!source) {
            console.warn(`EffectCache: Invalid source registered for ${sourceId}`);
            return;
        }
        
        const isFunction = typeof source === 'function';
        const filters = source.filters || {};
        
        this.sources.set(sourceId, {
            getEffects: isFunction ? source : () => source.getEffects(filters),
            onTrigger: source.onTrigger || null
        });
        this.dirtyFlags.set(sourceId, true);
        this.globalDirty = true;
    }

    unregisterSource(sourceId) {
        this.sources.delete(sourceId);
        this.dirtyFlags.delete(sourceId);
        this.globalDirty = true;
    }

    invalidate(sourceId) {
        if (this.dirtyFlags.has(sourceId)) {
            this.dirtyFlags.set(sourceId, true);
            this.globalDirty = true;
            this.allEffectsCache = null;
            this.cachedByTrigger.clear();
            this.bonusCache.clear();
        }
    }

    invalidateAll() {
        this.dirtyFlags.forEach((_, key) => this.dirtyFlags.set(key, true));
        this.globalDirty = true;
        this.allEffectsCache = null;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
    }

    isDirty() {
        return this.globalDirty;
    }

    rebuild() {
        if (!this.globalDirty) return;
        
        // Prevent infinite recursion when effect sources call back into other effect caches
        if (this._rebuilding) return;
        this._rebuilding = true;

        const allEffects = [];

        try {
            this.sources.forEach((source, sourceId) => {
                try {
                    const effects = source.getEffects();
                    if (Array.isArray(effects)) {
                        allEffects.push(...effects);
                    }
                } catch (e) {
                    console.warn(`EffectCache: Error getting effects from ${sourceId}:`, e);
                }
                this.dirtyFlags.set(sourceId, false);
            });

            this.allEffectsCache = allEffects;
            this.globalDirty = false;
            this.cachedByTrigger.clear();
            this.bonusCache.clear();
        } finally {
            this._rebuilding = false;
        }
    }

    getEffects(filters = null) {
        this.rebuild();

        if (filters === null || Object.keys(filters).length === 0) {
            return this.allEffectsCache || [];
        }

        // For simple trigger-only filter, use cached version
        if (Object.keys(filters).length === 1 && filters.trigger !== undefined) {
            const trigger = filters.trigger;
            if (this.cachedByTrigger.has(trigger)) {
                return this.cachedByTrigger.get(trigger);
            }

            const filtered = filterEffects(this.allEffectsCache || [], { trigger });
            this.cachedByTrigger.set(trigger, filtered);
            return filtered;
        }

        // For complex filters, compute on demand
        return filterEffects(this.allEffectsCache || [], filters);
    }

    getBonus(effectType, filter = {}) {
        this.rebuild();

        const filterKey = Object.keys(filter).length > 0
            ? ':' + Object.entries(filter).sort().map(([k, v]) => `${k}=${v}`).join(',')
            : '';
        const cacheKey = `bonus:${effectType}${filterKey}`;

        if (this.bonusCache.has(cacheKey)) {
            return this.bonusCache.get(cacheKey);
        }

        const passiveEffects = this.getEffects({ trigger: 'passive' });
        const total = passiveEffects
            .filter(e => {
                if (e.type !== effectType) return false;

                for (const [key, value] of Object.entries(filter)) {
                    if (e[key] !== value) return false;
                }
                return true;
            })
            .reduce((sum, e) => {
                const val = (e.value !== undefined) ? e.value : ((e.amount !== undefined) ? e.amount : 0);
                return sum + val;
            }, 0);

        this.bonusCache.set(cacheKey, total);
        return total;
    }

    /**
     * Get stat bonuses for a specific stat from all passive effects.
     * Handles both static values and scalable effects with getAmount().
     * @param {string} statId - The stat ID to get bonuses for
     * @param {Object} context - Optional context for scalable effects (character, combatJob, etc.)
     * @returns {{ flat: number, percent: number }} The stat bonuses
     */
    getStatBonus(statId, context = null) {
        this.rebuild();

        // Only cache if no context provided (static case)
        const cacheKey = `stat:${statId}`;
        if (!context && this.bonusCache.has(cacheKey)) {
            return this.bonusCache.get(cacheKey);
        }

        const passiveEffects = this.getEffects({ trigger: 'passive' });
        let flat = 0;
        let percent = 0;

        passiveEffects.forEach(e => {
            if (e.stat === statId) {
                // Handle scalable effects with getAmount method
                if (typeof e.getAmount === 'function') {
                    const source = context?.character || null;
                    const amount = e.getAmount(source, null, context);
                    if (e.type === 'stat_flat') {
                        flat += amount;
                    } else if (e.type === 'stat_percent') {
                        percent += amount;
                    }
                } else {
                    // Static value
                    const value = e.value !== undefined ? e.value : (e.amount !== undefined ? e.amount : 0);
                    if (e.type === 'stat_flat') {
                        flat += value;
                    } else if (e.type === 'stat_percent') {
                        percent += value;
                    }
                }
            }
        });

        const result = { flat, percent };
        
        // Only cache static results
        if (!context) {
            this.bonusCache.set(cacheKey, result);
        }
        
        return result;
    }

    clear() {
        this.allEffectsCache = null;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
        this.globalDirty = true;
    }

    /**
     * Get conditional bonus for an effect type.
     * @param {string} effectType - The effect type to sum
     * @param {Object} context - Context for condition evaluation and scaling
     * @returns {number} Total bonus value
     */
    getConditionalBonus(effectType, context) {
        this.rebuild();

        const passiveEffects = this.getEffects({ trigger: 'passive' });
        return passiveEffects
            .filter(e => {
                if (e.type !== effectType) return false;

                if (e.condition) {
                    return evaluateCondition(e.condition, context);
                }
                return true;
            })
            .reduce((sum, e) => {
                // Handle scalable effects
                if (typeof e.getAmount === 'function') {
                    return sum + e.getAmount(context?.character, null, context);
                }
                const val = (e.value !== undefined) ? e.value : ((e.amount !== undefined) ? e.amount : 0);
                return sum + val;
            }, 0);
    }

    /**
     * Validates an effect before processing (condition, limit, chance checks)
     * @param {Object} effect - The effect to validate
     * @param {Object} context - The effect context
     * @param {Object} limitTracker - EffectLimitTracker instance
     * @returns {boolean} Whether the effect should be processed
     */
    validateEffect(effect, context, limitTracker = null) {
        // Check condition
        if (effect.condition) {
            if (!evaluateCondition(effect.condition, context)) {
                return false;
            }
        }

        // Check limit tracker
        if (limitTracker && !limitTracker.canTrigger(effect, effect.source)) {
            return false;
        }

        // Check chance
        const chance = effect.chance || 100;
        if (Math.random() * 100 > chance) {
            return false;
        }

        return true;
    }

    /**
     * Process all effects for a trigger type with unified application.
     * @param {string} trigger - The trigger type
     * @param {Object} context - The effect context  
     * @param {Object} options - Processing options
     * @param {Object} [options.host] - The entity that owns this cache (for applyEffect)
     * @param {Object} [options.limitTracker] - EffectLimitTracker instance
     * @param {Function} [options.effectModifier] - Transform effect before apply: (effect) => effect
     * @param {Object} [options.filters] - Additional filters beyond trigger
     * @returns {Array} Array of applied effects
     */
    processTrigger(trigger, context, options = {}) {
        const { host, limitTracker, effectModifier, filters = {} } = options;
        
        const effects = this.getEffects({ trigger, ...filters });
        const applied = [];

        for (const effect of effects) {
            if (!this.validateEffect(effect, context, limitTracker)) {
                continue;
            }

            // Allow caller to modify effect before application
            const finalEffect = effectModifier ? effectModifier(effect) : effect;
            
            // Apply the effect - returns true if handler was invoked with valid targets
            const triggered = this.applyEffect(finalEffect, host, context);
            
            if (!triggered) {
                continue;
            }
            
            applied.push(effect);
            
            if (limitTracker) {
                limitTracker.record(effect, effect.source);
            }
            
            // Call source's onTrigger callback if registered and effect actually triggered
            // Get source type from sourcePath (first entry) for callback lookup
            const sourceType = effect.sourcePath && effect.sourcePath.length > 0 
                ? effect.sourcePath[0].type 
                : null;
            const sourceConfig = sourceType ? this.sources.get(sourceType) : null;
            if (sourceConfig?.onTrigger) {
                sourceConfig.onTrigger(finalEffect, context, host);
            }
        }

        return applied;
    }
    
    /**
     * Apply a single effect to a host entity.
     * Handles dynamic amounts and delegates to defaultEffectProcessor.
     * @param {Object} effect - The effect to apply
     * @param {Object} host - The entity receiving the effect
     * @param {Object} context - The effect context
     * @returns {boolean} True if handler was invoked with valid targets (effect triggered)
     */
    applyEffect(effect, host, context) {
        // Get source info from sourcePath
        const sourcePath = effect.sourcePath || [];
        const leafSource = sourcePath.length > 0 ? sourcePath[sourcePath.length - 1] : null;
        const sourceName = leafSource?.name || 'Unknown';

        // Calculate amount and stacks from the effect
        // Pass host (character) as source for stat-based scaling
        const amount = typeof effect.getAmount === 'function' 
            ? effect.getAmount(host, null, context) 
            : (effect.amount ?? effect.value ?? 0);
        const stacks = typeof effect.getStacks === 'function'
            ? effect.getStacks(host, null, context)
            : (effect.stacks ?? 0);

        // Build processor context and apply
        const processorContext = {
            character: host,
            caster: host,
            manager: host?.manager || context?.manager,
            extra: context
        };
        
        return defaultEffectProcessor.processEffect(effect, amount, stacks, sourceName, processorContext, resolveTargets);
    }
}
