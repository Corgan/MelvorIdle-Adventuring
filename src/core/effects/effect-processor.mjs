/**
 * Effect processor with registered handlers for all effect types.
 * Handles the execution of effects during combat and other game events.
 */

const { loadModule } = mod.getContext(import.meta);

const { evaluateCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');

// ============================================================================
// XP Divisors - adjust these to balance XP from different sources
// Higher = less XP, Lower = more XP
// ============================================================================
export const XP_DIVISORS = {
    DAMAGE_DEALT: 250,      // XP for dealing damage
    DAMAGE_TAKEN: 250,      // XP for taking damage (heroes only, from enemies)
    HEALING_DONE: 250       // XP for healing others
};

// Utility: Return first defined value from arguments
function firstDefined(...values) {
    for (const v of values) {
        if (v !== undefined) return v;
    }
    return values[values.length - 1];
}

// ============================================================================
// Effect Creation and Context
// ============================================================================

/**
 * Create a normalized effect object from effect data
 * @param {Object} effectData - Raw effect data
 * @param {Object} source - Source object (item, skill, etc.)
 * @param {string} sourceName - Display name of the source
 * @param {string} [sourceType] - Type of source (item, skill, etc.)
 * @returns {Object} Normalized effect object
 */
/**
 * Create a standardized effect object with source path metadata
 * @param {Object} effectData - The raw effect data
 * @param {Array} sourcePath - Array of {type, name, ref} describing the source hierarchy
 * @returns {Object} Standardized effect object
 */
export function createEffect(effectData, sourcePath = []) {
    return {
        ...effectData,
        trigger: effectData.trigger || 'passive',
        type: effectData.type,
        stat: effectData.stat || effectData.id,  // stat effects use 'stat', auras use 'id'
        value: firstDefined(effectData.value, effectData.amount, 0),
        target: effectData.target,
        condition: effectData.condition || null,  // Condition object for conditional triggers
        chance: effectData.chance,  // Shorthand for simple chance conditions
        stacks: effectData.stacks,  // For buff/debuff effects
        id: effectData.id || effectData.aura || effectData.buff || effectData.debuff,  // Aura ID for buff/debuff
        sourcePath: sourcePath
    };
}

/**
 * Prepend a source path entry to an effect's sourcePath
 * @param {Object} effect - The effect to update
 * @param {Object} pathEntry - {type, name, ref} to prepend
 * @returns {Object} New effect with updated sourcePath
 */
export function prependSourcePath(effect, pathEntry) {
    return {
        ...effect,
        sourcePath: [pathEntry, ...(effect.sourcePath || [])]
    };
}

/**
 * Filter effects by criteria
 * @param {Array} effects - Array of effect objects
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.trigger] - Filter by trigger type
 * @param {string} [filters.party] - Filter by party target
 * @param {string} [filters.type] - Filter by effect type
 * @param {string} [filters.stat] - Filter by stat id
 * @param {string} [filters.target] - Filter by target
 * @param {string} [filters.scope] - Filter by scope
 * @returns {Array} Filtered effects
 */
export function filterEffects(effects, filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
        return effects;
    }
    
    return effects.filter(effect => {
        if (filters.trigger !== undefined && effect.trigger !== filters.trigger) return false;
        if (filters.party !== undefined && effect.party !== filters.party) return false;
        if (filters.type !== undefined && effect.type !== filters.type) return false;
        if (filters.stat !== undefined && effect.stat !== filters.stat) return false;
        if (filters.target !== undefined && effect.target !== filters.target) return false;
        // Scope filter: 'individual' matches both 'individual' and undefined
        if (filters.scope !== undefined) {
            if (filters.scope === 'individual') {
                if (effect.scope === 'party') return false;
            } else {
                if (effect.scope !== filters.scope) return false;
            }
        }
        return true;
    });
}

// Context pool for performance
const contextPool = [];
const MAX_POOL_SIZE = 16;

/**
 * Get a pooled context object for reuse
 * @returns {Object} Empty or recycled context object
 */
export function getPooledContext() {
    return contextPool.pop() || {};
}

/**
 * Release a context object back to the pool
 * @param {Object} ctx - Context object to release
 */
export function releaseContext(ctx) {
    if (!ctx || contextPool.length >= MAX_POOL_SIZE) return;

    for (const key in ctx) {
        if (Object.prototype.hasOwnProperty.call(ctx, key)) {
            ctx[key] = undefined;
        }
    }
    contextPool.push(ctx);
}

// Simple effect instance for static effects (not from auras)
export class SimpleEffectInstance {
    constructor(amount, sourceName, stacks = 1, source = null) {
        this.amount = amount;
        this.stacks = stacks;
        this.base = { name: sourceName, consume: false };
        this.source = source;
        this.age = 0;
        this._isSimple = true;
    }

    remove_stacks(count) { }
    remove() { }
}

// Get effective amount from an effect and its instance
// Returns just the numeric value. For consumes, use getEffectAmountWithConsumes.
export function getEffectAmount(effect, instance) {
    if (instance._isSimple) {
        return instance.amount;
    }

    if (effect.getAmount) {
        const result = effect.getAmount(instance);
        // Handle new object return type { value, consumes }
        if (result !== null && typeof result === 'object' && 'value' in result) {
            return result.value;
        }
        return result;
    }

    return effect.value ?? effect.amount ?? 0;
}

// Get effective amount with consume operations for aura scaling
export function getEffectAmountWithConsumes(effect, instance, context) {
    if (instance._isSimple) {
        return { value: instance.amount, consumes: [] };
    }

    if (effect.getAmount) {
        const result = effect.getAmount(instance?.source, null, context);
        // Handle object return type { value, consumes }
        if (result !== null && typeof result === 'object' && 'value' in result) {
            return result;
        }
        return { value: result, consumes: [] };
    }

    return { value: effect.value ?? effect.amount ?? 0, consumes: [] };
}

// XP values for utility effects
const UTILITY_EFFECT_XP = {
    skip: 3,
    miss: 2,
    confuse: 4,
    prevent_ability: 2,
    dodge: 2
};

/**
 * Award combat XP to a hero's equipment and combat job.
 */
export function awardCombatXP(character, baseXP, manager) {
    if (!character?.isHero || baseXP <= 0) return;
    
    const xp = Math.floor(baseXP * (manager.dungeon?.getDifficultyXPMultiplier() || 1));
    
    // Track XP for analysis
    if (globalThis.xpTracker) {
        globalThis.xpTracker.damageHeal += xp;  // Equipment gets full xp
        globalThis.xpTracker.damageHealJob += Math.floor(xp / 3);  // Job gets xp/3 (of already /5 base)
        globalThis.xpTracker.calls = (globalThis.xpTracker.calls || 0) + 1;
    }
    
    character.equipment?.forEachEquipped(item => item.addXP(xp));
    
    if (character.combatJob?.isMilestoneReward) {
        character.combatJob.addXP(Math.floor(xp / 3));
    }
}

/**
 * Award XP from an effect instance to its source character.
 */
function awardSourceXP(instance, baseXP, ctx) {
    if (!instance?.source) return;
    awardCombatXP(instance.source, baseXP, ctx.manager);
}

// Get aura name for logging
function getAuraName(manager, auraId) {
    if (!auraId) return 'Unknown';

    const idPart = auraId.split(':').pop();
    const prettified = idPart ? idPart.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    if (manager === undefined || manager.auras === undefined) {
        return prettified;
    }
    const aura = manager.auras.getObjectByID(auraId);
    return aura !== undefined ? aura.name : prettified;
}

/**
 * Build effect context for condition evaluation
 */
export function buildEffectContext(character, extra = {}, pooledCtx = null) {
    let manager = null;
    if (character && character.manager) {
        manager = character.manager;
    } else if (extra.manager) {
        manager = extra.manager;
    }

    let partyMembers = [];
    if (manager && manager.party) {
        if (manager.party.members) {
            partyMembers = manager.party.members;
        } else if (manager.party.all) {
            partyMembers = manager.party.all;
        }
    }

    const ctx = pooledCtx || {};

    ctx.character = character;
    ctx.target = extra.target || null;
    ctx.attacker = extra.attacker || null;
    ctx.party = partyMembers;
    ctx.manager = manager;
    ctx.hpPercentBefore = extra.hpPercentBefore;
    ctx.damageDealt = extra.damageDealt;
    ctx.damageReceived = extra.damageReceived;

    for (const key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key) && ctx[key] === undefined) {
            ctx[key] = extra[key];
        }
    }

    return ctx;
}

/**
 * Main effect processor class with registered handlers.
 */
export class EffectProcessor {
    constructor() {
        this.handlers = new Map();
    }

    register(type, handler) {
        this.handlers.set(type, handler);
    }

    process(resolved, context) {
        const { effect, instance } = resolved;
        const handler = this.handlers.get(effect.type);

        if (handler) {
            return handler(effect, instance, context);
        }

        return context.extra;
    }

    processSimple(effect, amount, sourceName, context) {
        const handler = this.handlers.get(effect.type);

        if (handler) {
            const source = context.caster || context.character;
            const instance = new SimpleEffectInstance(amount, sourceName, effect.stacks || 1, source);
            return handler(effect, instance, context);
        }

        return context.extra;
    }

    /**
     * Process an effect: resolve targets, invoke handler, award XP.
     * Unified processing path for all effect types and targeting modes.
     */
    processEffect(effect, amount, stacks, sourceName, context, resolveTargets) {
        const targetType = effect.target || 'self';
        const partyType = effect.party || effect.targetParty || 'ally';
        
        const encounter = context.extra?.encounter;
        const targetParty = partyType === 'enemy' 
            ? encounter?.party 
            : context.manager.party;
        
        const isRemoveEffect = effect.type === 'remove' || effect.type === 'remove_stacks';
        
        const resolveContext = {
            party: targetParty,
            self: context.character,
            attacker: context.extra?.attacker,
            target: context.extra?.target,
            exclude: null,
            allowDead: isRemoveEffect
        };
        
        const targets = resolveTargets(targetType, resolveContext);
        
        if (targets.length === 0) {
            return false;
        }
        
        const source = context.caster || context.character;
        const instance = (effect.source && !effect.source._isSimple && typeof effect.source.remove === 'function')
            ? effect.source
            : new SimpleEffectInstance(amount, sourceName, stacks, source);
        const handler = this.handlers.get(effect.type);
        
        if (!handler) {
            console.warn(`[applyEffect] No handler for effect type: ${effect.type}`);
            return false;
        }
        
        const caster = context.caster || context.character;
        
        for (const target of targets) {
            const targetContext = {
                ...context,
                character: target,
                caster: caster
            };
            
            handler(effect, instance, targetContext);
        }
        
        return true;
    }

    processAll(resolvedEffects, context) {
        resolvedEffects.forEach(resolved => {
            const { effect, instance } = resolved;

            if (effect.condition) {
                const evalContext = buildEffectContext(context.character, context.extra);
                if (!evaluateCondition(effect.condition, evalContext)) {
                    return;
                }
            }

            const chance = effect.chance || 100;
            if (Math.random() * 100 > chance) {
                return;
            }

            context.extra = this.process(resolved, context);
        });
        return context.extra;
    }

    hasHandler(type) {
        return this.handlers.has(type);
    }

    unregister(type) {
        this.handlers.delete(type);
    }

    clear() {
        this.handlers.clear();
    }
}

/**
 * Creates the default effect processor with all standard handlers registered.
 */
export function createDefaultEffectProcessor() {
    const processor = new EffectProcessor();

    processor.register('reduce_amount', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const reduce = Math.min(ctx.extra.amount || 0, amount);
        ctx.extra.amount -= reduce;
        if (instance.base && instance.base.consume) {
            instance.remove_stacks(reduce);
        }
        return ctx.extra;
    });

    const damageOrHeal = (effect, instance, ctx) => {
        // Build context for aura scaling (caster = source of ability, target = receiver)
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;
        const scaleContext = { character: caster, target: target };
        
        // Get amount with potential consume operations
        const { value: amount, consumes } = getEffectAmountWithConsumes(effect, instance, scaleContext);
        const builtEffect = { amount };
        const isDamage = effect.type.includes('damage');
        const effectLabel = isDamage ? 'damage' : 'healing';

        ctx.manager.log.add(`${target.getDisplayName()} receives ${amount} ${effectLabel} from ${instance.base.name}`, {
            category: isDamage ? 'combat_damage' : 'combat_heal',
            source: caster,
            target: target
        });
        
        // applyEffect returns effective amount (clamped to actual HP change, no overkill/overheal)
        const effectiveAmount = target.applyEffect(effect, builtEffect, caster);
        
        // Apply any pending consume operations (e.g., consume Bleed stacks)
        if (consumes && consumes.length > 0 && effect.applyConsumes) {
            effect.applyConsumes(consumes);
        }

        // Award XP to source (damage dealer / healer) based on EFFECTIVE amount
        if (effectiveAmount > 0 && instance.source) {
            const divisor = isDamage ? XP_DIVISORS.DAMAGE_DEALT : XP_DIVISORS.HEALING_DONE;
            awardSourceXP(instance, Math.floor(effectiveAmount / divisor), ctx);
        }
        
        // Award XP to target for damage taken (heroes only, from enemy attacks)
        if (isDamage && effectiveAmount > 0 && target.isHero && caster && !caster.isHero) {
            awardCombatXP(target, Math.floor(effectiveAmount / XP_DIVISORS.DAMAGE_TAKEN), ctx.manager);
        }
        
        return ctx.extra;
    };
    processor.register('damage_flat', damageOrHeal);
    processor.register('heal_flat', damageOrHeal);

    processor.register('heal_percent', (effect, instance, ctx) => {
        const percentValue = (effect.amount !== undefined) ? effect.amount : ((instance.amount !== undefined) ? instance.amount : 0);
        if (percentValue <= 0) return ctx.extra;

        const target = ctx.character;
        const caster = ctx.caster || ctx.character;
        
        const healAmount = Math.ceil(target.maxHitpoints * (percentValue / 100));
        // heal() returns actual heal amount (clamped, no overhealing)
        const actualHeal = target.heal({ amount: healAmount }, caster) || 0;
        
        const casterName = caster?.getDisplayName?.() || caster?.name || 'Effect';
        const sourceName = instance.base?.name || effect.sourcePath?.[effect.sourcePath?.length - 1]?.name || 'effect';
        ctx.manager.log.add(`${casterName}'s ${sourceName} heals ${target.getDisplayName()} for ${actualHeal} (${percentValue}%)`, {
            category: 'combat_heal',
            source: caster,
            target: target
        });

        // Award XP to source (healer) based on EFFECTIVE heal
        if (actualHeal > 0 && instance.source) {
            awardSourceXP(instance, Math.floor(actualHeal / XP_DIVISORS.HEALING_DONE), ctx);
        }

        return ctx.extra;
    });

    const BUFF_POOL = [
        'adventuring:might', 'adventuring:fortify', 'adventuring:haste',
        'adventuring:regeneration', 'adventuring:barrier', 'adventuring:focus',
        'adventuring:arcane_power', 'adventuring:stealth'
    ];

    const DEBUFF_POOL = [
        'adventuring:weaken', 'adventuring:slow', 'adventuring:blind',
        'adventuring:poison', 'adventuring:burn', 'adventuring:decay',
        'adventuring:vulnerability', 'adventuring:chill'
    ];

    processor.register('buff', (effect, instance, ctx) => {
        const stacks = instance.stacks || effect.stacks || 1;
        const builtEffect = { stacks };
        const count = effect.count || 1;
        
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;

        let auraIds = [];
        if (effect.random) {
            const pool = effect.pool || BUFF_POOL;
            for (let i = 0; i < count; i++) {
                auraIds.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        } else {
            if (!effect.id) {
                console.warn('[buff processor] Missing aura id in effect:', effect);
                return ctx.extra;
            }
            auraIds.push(effect.id);
        }

        for (const auraId of auraIds) {
            const casterName = caster?.getDisplayName?.() || caster?.name || 'Effect';
            ctx.manager.log.add(`${casterName}'s ${instance.base.name} applies ${getAuraName(ctx.manager, auraId)} to ${target.getDisplayName()}`, {
                category: 'status_buff',
                source: caster,
                target: target
            });
            target.auras.add(auraId, { ...builtEffect }, caster);
        }
        return ctx.extra;
    });

    processor.register('debuff', (effect, instance, ctx) => {
        const stacks = instance.stacks || effect.stacks || 1;
        const builtEffect = { stacks };
        const count = effect.count || 1;
        
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;

        let auraIds = [];
        if (effect.random) {
            const pool = effect.pool || DEBUFF_POOL;
            for (let i = 0; i < count; i++) {
                auraIds.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        } else {
            if (!effect.id) {
                console.warn('[debuff processor] Missing aura id in effect:', effect);
                return ctx.extra;
            }
            auraIds.push(effect.id);
        }

        if (!target.dead) {
            for (const auraId of auraIds) {
                const casterName = caster?.getDisplayName?.() || caster?.name || 'Effect';
                ctx.manager.log.add(`${casterName}'s ${instance.base.name} applies ${getAuraName(ctx.manager, auraId)} to ${target.getDisplayName()}`, {
                    category: 'status_debuff',
                    source: caster,
                    target: target
                });
                target.auras.add(auraId, { ...builtEffect }, caster);
            }
        }
        return ctx.extra;
    });

    processor.register('energy', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        ctx.character.energy = Math.min(ctx.character.maxEnergy, ctx.character.energy + amount);
        ctx.character.renderQueue.energy = true;
        return ctx.extra;
    });

    processor.register('remove_stacks', (effect, instance, ctx) => {
        let count = 1;
        if (effect.count !== undefined) {
            count = effect.count < 1
                ? Math.ceil(instance.stacks * effect.count)
                : effect.count;
        }
        instance.remove_stacks(count);
        return ctx.extra;
    });

    processor.register('remove', (effect, instance, ctx) => {
        if (effect.age !== undefined) {
            if (instance.age >= effect.age) {
                instance.remove();
            }
        } else {
            instance.remove();
        }
        return ctx.extra;
    });

    processor.register('damage_modifier_flat', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        ctx.extra.amount = (ctx.extra.amount || 0) + amount;

        if (amount > 0 && instance.source) {
            ctx.extra.damageContributions = ctx.extra.damageContributions || [];
            ctx.extra.damageContributions.push({ source: instance.source, amount });
        }
        
        return ctx.extra;
    });

    processor.register('damage_modifier_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;

        if (increase > 0 && instance.source) {
            ctx.extra.damageContributions = ctx.extra.damageContributions || [];
            ctx.extra.damageContributions.push({ source: instance.source, amount: increase });
        }
        
        return ctx.extra;
    });

    processor.register('reduce_damage_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const reduction = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = Math.max(0, (ctx.extra.amount || 0) - reduction);
        return ctx.extra;
    });

    processor.register('reduce_heal_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const reduction = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = Math.max(0, (ctx.extra.amount || 0) - reduction);
        return ctx.extra;
    });

    const checkCondition = (effect, instance) => {
        if (!effect.condition) return true;
        if (effect.condition.type === 'chance') {
            const chance = effect.condition.value || 0;
            return Math.random() * 100 < chance;
        }
        return true;
    };

    processor.register('skip', (effect, instance, ctx) => {
        if (checkCondition(effect, instance)) {
            ctx.extra.skip = true;
            ctx.manager.log.add(`${ctx.character.name} is overcome with ${instance.base.name}!`, {
                category: 'combat_mechanics',
                source: ctx.character
            });

            if (instance.source) {
                awardSourceXP(instance, UTILITY_EFFECT_XP.skip, ctx);
            }
        }
        return ctx.extra;
    });

    processor.register('dodge', (effect, instance, ctx) => {
        if (checkCondition(effect, instance)) {
            ctx.extra.amount = 0;
            ctx.extra.dodged = true;
            ctx.manager.log.add(`${ctx.character.name} dodges the attack!`, {
                category: 'combat_miss',
                source: ctx.character
            });

            if (instance.source && instance.source !== ctx.character) {
                awardSourceXP(instance, UTILITY_EFFECT_XP.dodge, ctx);
            }
        }
        return ctx.extra;
    });

    processor.register('miss', (effect, instance, ctx) => {
        if (checkCondition(effect, instance)) {
            ctx.extra.amount = 0;
            ctx.extra.missed = true;
            ctx.manager.log.add(`${ctx.character.name} misses due to ${instance.base.name}!`, {
                category: 'combat_miss',
                source: ctx.character
            });

            if (instance.source) {
                awardSourceXP(instance, UTILITY_EFFECT_XP.miss, ctx);
            }
        }
        return ctx.extra;
    });

    processor.register('confuse', (effect, instance, ctx) => {
        if (checkCondition(effect, instance)) {
            ctx.extra.hitAlly = true;
            ctx.manager.log.add(`${ctx.character.name} is confused and attacks an ally!`, {
                category: 'combat_mechanics',
                source: ctx.character
            });

            if (instance.source) {
                awardSourceXP(instance, UTILITY_EFFECT_XP.confuse, ctx);
            }
        }
        return ctx.extra;
    });

    processor.register('untargetable', (effect, instance, ctx) => {
        ctx.extra.untargetable = true;
        return ctx.extra;
    });

    processor.register('prevent_debuff', (effect, instance, ctx) => {
        ctx.extra.prevented = true;
        ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} prevents the debuff!`, {
            category: 'status_cleanse',
            source: ctx.character
        });
        return ctx.extra;
    });

    processor.register('prevent_ability', (effect, instance, ctx) => {
        ctx.extra.prevented = true;

        if (instance.source) {
            awardSourceXP(instance, UTILITY_EFFECT_XP.prevent_ability, ctx);
        }
        
        return ctx.extra;
    });

    processor.register('prevent_death', (effect, instance, ctx) => {
        ctx.extra.prevented = true;
        ctx.extra.preventDeathHealAmount = getEffectAmount(effect, instance) || 0;
        ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} prevents death!`, {
            category: 'combat_death',
            source: ctx.character
        });
        return ctx.extra;
    });

    processor.register('force_target', (effect, instance, ctx) => {
        if (instance.source) {
            ctx.extra.forcedTarget = instance.source;
        }
        return ctx.extra;
    });

    processor.register('immune', (effect, instance, ctx) => {
        if (effect.id && ctx.extra.auraId === effect.id) {
            ctx.extra.prevented = true;
            ctx.manager.log.add(`${ctx.character.name} is immune to ${effect.id}!`, {
                category: 'status_debuff',
                source: ctx.character
            });
        } else if (!effect.id) {
            ctx.extra.prevented = true;
            ctx.manager.log.add(`${ctx.character.name} is immune to debuffs!`, {
                category: 'status_debuff',
                source: ctx.character
            });
        }
        return ctx.extra;
    });

    processor.register('revive', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance) || 100;
        const target = effect.target === 'target' ? ctx.extra.target : ctx.character;

        if (target && target.dead) {
            target.revive({ amount }, ctx.character);
            const sourceName = instance?.base?.name || 'effect';
            ctx.manager.log.add(`${ctx.character.name}'s ${sourceName} revives ${target.name} with ${amount}% HP!`, {
                category: 'combat_heal',
                source: ctx.character,
                target: target
            });
        }
        return ctx.extra;
    });

    // Passive bonus handlers - these just exist so applyEffect doesn't warn
    // The actual effect summing happens in effectCache.getBonus()
    processor.register('crit_chance', (effect, instance, ctx) => {
        return ctx.extra;
    });

    processor.register('crit_damage', (effect, instance, ctx) => {
        return ctx.extra;
    });

    processor.register('lifesteal', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const healAmount = Math.ceil((ctx.extra.damageDealt || 0) * (amount / 100));
        if (healAmount > 0) {
            ctx.character.heal({ amount: healAmount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name} heals for ${healAmount} from ${instance.base.name}`, {
                category: 'combat_heal',
                source: ctx.character
            });
        }
        return ctx.extra;
    });

    processor.register('reflect', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if (ctx.extra.damageReceived && ctx.extra.attacker) {
            const reflectAmount = Math.ceil(ctx.extra.damageReceived * (amount / 100));
            ctx.extra.attacker.damage({ amount: reflectAmount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} reflects ${reflectAmount} damage`, {
                category: 'combat_damage',
                source: ctx.character,
                target: ctx.extra.attacker
            });
        }
        return ctx.extra;
    });

    processor.register('cleanse', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance) || effect.count || 999;
        const target = effect.target === 'self' || effect.target === undefined ? ctx.character :
                      (effect.target === 'attacker' ? ctx.extra.attacker : ctx.extra.target);
        if (target && !target.dead && target.auras) {
            let removed = 0;
            for (const auraInstance of [...target.auras.auras.values()]) {
                if (auraInstance.base && auraInstance.base.isDebuff && removed < amount) {
                    auraInstance.stacks = 0;
                    removed++;
                }
            }
            if (removed > 0) {
                target.auras.cleanAuras();
                target.auras.renderQueue.auras = true;
                if (target.effectCache) {
                    target.invalidateEffects('auras');
                }
                ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} cleanses ${removed} debuff(s) from ${target.name}`, {
                    category: 'status_cleanse',
                    source: ctx.character,
                    target: target
                });
            }
        }
        return ctx.extra;
    });

    processor.register('damage_percent', (effect, instance, ctx) => {
        const percent = getEffectAmount(effect, instance);

        let target;
        const targetType = effect.target || 'target';
        if (targetType === 'self') {
            target = ctx.character;
        } else if (targetType === 'attacker' && ctx.extra.attacker) {
            target = ctx.extra.attacker;
        } else if (ctx.extra.target) {
            target = ctx.extra.target;
        }

        if (target && !target.dead) {
            const amount = Math.floor(target.maxHitpoints * (percent / 100));
            target.damage({ amount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} deals ${amount} damage (${percent}% HP)`, {
                category: 'combat_damage',
                source: ctx.character,
                target: target
            });
        }
        return ctx.extra;
    });

    // Deals % of target's CURRENT HP as damage, floored to leave at least 1 HP
    // (deals 0 damage when target has 1 HP)
    processor.register('damage_percent_current', (effect, instance, ctx) => {
        const percent = getEffectAmount(effect, instance);

        // Target is ctx.character (set by encounter system when processing hits)
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;

        if (target && !target.dead) {
            // Calculate damage based on current HP, floored to leave at least 1 HP
            const currentHP = target.hitpoints;
            const rawDamage = Math.floor(currentHP * (percent / 100));
            // Ensure we leave at least 1 HP (deal 0 if target is at 1 HP)
            const amount = currentHP > 1 ? Math.min(rawDamage, currentHP - 1) : 0;
            
            if (amount > 0) {
                target.damage({ amount }, caster);
                ctx.manager.log.add(`${caster.name}'s ${instance.base.name} deals ${amount} damage (${percent}% current HP)`, {
                    category: 'combat_damage',
                    source: caster,
                    target: target
                });
            }
        }
        return ctx.extra;
    });

    processor.register('xp_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });

    processor.register('loot_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });

    processor.register('prevent_lethal', (effect, instance, ctx) => {
        const currentHP = ctx.character.hitpoints;
        const incomingDamage = ctx.extra.amount || 0;

        if (currentHP - incomingDamage <= 0 && currentHP > 0) {
            ctx.extra.amount = currentHP - 1;
            ctx.extra.preventedLethal = true;
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} prevents lethal damage!`, {
                category: 'combat_death',
                source: ctx.character
            });
        }
        return ctx.extra;
    });

    processor.register('evade', (effect, instance, ctx) => {
        ctx.extra.amount = 0;
        ctx.extra.evaded = true;
        if (effect.consume !== false) {
            instance.remove_stacks(1);
        }
        ctx.manager.log.add(`${ctx.character.name} evades the attack with ${instance.base.name}!`, {
            category: 'combat_miss',
            source: ctx.character
        });
        return ctx.extra;
    });

    processor.register('absorb', (effect, instance, ctx) => {
        const amountPerStack = firstDefined(effect.amount, 1);
        const stackCount = typeof instance.stacks === 'number' ? instance.stacks : 1;
        const totalAbsorb = amountPerStack * stackCount;
        const damage = ctx.extra.amount || 0;

        if (isNaN(totalAbsorb) || isNaN(damage)) {
            console.warn('[absorb] NaN detected - amountPerStack:', amountPerStack, 'stacks:', instance.stacks, 'damage:', damage);
            return ctx.extra;
        }

        const absorbed = Math.min(damage, totalAbsorb);
        ctx.extra.amount = damage - absorbed;

        if (effect.consume !== false && absorbed > 0) {
            const stacksToRemove = Math.ceil(absorbed / amountPerStack);
            instance.remove_stacks(stacksToRemove);
        }

        if (absorbed > 0) {
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} absorbs ${absorbed} damage`, {
                category: 'combat_mechanics',
                source: ctx.character
            });
        }
        return ctx.extra;
    });

    processor.register('dispel', (effect, instance, ctx) => {
        const count = effect.count || 1;
        const target = effect.target === 'self' ? ctx.character :
                      (effect.target === 'attacker' ? ctx.extra.attacker : ctx.extra.target);

        if (target && !target.dead && target.auras) {
            let removed = 0;

            for (const auraInstance of [...target.auras.auras.values()]) {
                if (auraInstance.base && !auraInstance.base.isDebuff && removed < count) {
                    auraInstance.stacks = 0;
                    removed++;
                }
            }
            if (removed > 0) {
                target.auras.cleanAuras();
                target.auras.renderQueue.auras = true;
                if (target.effectCache) {
                    target.invalidateEffects('auras');
                }
                ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} dispels ${removed} buff(s) from ${target.name}`, {
                    category: 'status_cleanse',
                    source: ctx.character,
                    target: target
                });
            }
        }
        return ctx.extra;
    });

    processor.register('double_cast', (effect, instance, ctx) => {
        let chance;
        if (effect.condition && effect.condition.type === 'chance') {
            chance = effect.condition.value;
        } else {
            chance = effect.chance || getEffectAmount(effect, instance);
        }
        if (Math.random() * 100 < chance) {
            ctx.extra.doubleCast = true;
        }
        return ctx.extra;
    });

    processor.register('work', (effect, instance, ctx) => {
        if (ctx.extra.building && ctx.extra.building.page && ctx.extra.building.page.doWork) {
            ctx.extra.building.page.doWork(ctx.character);
        }
        return ctx.extra;
    });

    return processor;
}

// Create and export the default processor instance
export const defaultEffectProcessor = createDefaultEffectProcessor()