/**
 * Core utility functions for the Adventuring mod.
 * This file contains general-purpose utilities and re-exports from specialized modules.
 */

const { loadModule } = mod.getContext(import.meta);

// Import from specialized modules
const { evaluateCondition, describeCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');
const { 
    describeEffectFromData,
    describeEffectFull,
    formatTriggerFromData, 
    formatTargetFromData, 
    isLoaded: isEffectDescriptionsLoaded,
    describeLimitSuffix,
    // Description wrappers
    getAuraName,
    parseDescription,
    describeEffect,
    formatTrigger,
    formatTarget,
    formatTriggerSuffix,
    joinEffectDescriptions,
    describeEffects,
    describeEffectsInline,
    getEffectDescriptionsList
} = await loadModule('src/core/effects/effect-descriptions.mjs');
const {
    EffectProcessor,
    SimpleEffectInstance,
    getEffectAmount,
    getEffectAmountWithConsumes,
    awardCombatXP,
    buildEffectContext,
    createDefaultEffectProcessor,
    defaultEffectProcessor,
    // Effect creation
    createEffect,
    prependSourcePath,
    filterEffects,
    getPooledContext,
    releaseContext
} = await loadModule('src/core/effects/effect-processor.mjs');
const {
    AdventuringMasteryRenderQueue,
    AdventuringBadgeRenderQueue,
    AdventuringEquipmentRenderQueue
} = await loadModule('src/core/utils/render-queues.mjs');
const {
    resolveTargets,
    sortByAgility,
    isInCombat
} = await loadModule('src/core/utils/targeting.mjs');
const {
    buildDescription,
    buildEffectReplacements,
    buildHitEffectReplacements
} = await loadModule('src/core/effects/build-description.mjs');

// ============================================================================
// General Utility Functions
// ============================================================================

/**
 * Return first defined value from arguments
 */
function firstDefined(...values) {
    for (const v of values) {
        if (v !== undefined) return v;
    }
    return values[values.length - 1];
}

/**
 * Get a random element from an array
 */
function randomElement(array) {
    if(!array || array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Roll against a percentage chance
 */
function rollChance(chance) {
    return Math.random() * 100 < chance;
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Convert value to percentage of max
 */
function toPercent(value, max) {
    if(max <= 0) return 0;
    return clamp((value / max) * 100, 0, 100);
}

// ============================================================================
// Media Utilities
// ============================================================================

const UNKNOWN_MEDIA = 'melvor:assets/media/main/question.png';

/**
 * Get media URL, using locked placeholder if not unlocked
 */
function getLockedMedia(obj) {
    return obj.unlocked ? obj.getMediaURL(obj._media) : obj.getMediaURL(UNKNOWN_MEDIA);
}

// ============================================================================
// Passive Effect Processor (Combat Pipeline)
// ============================================================================

const BASE_CRIT_MULTIPLIER = 1.5;

class PassiveEffectProcessor {
    constructor(encounter) {
        this.encounter = encounter;
        this.manager = encounter.manager;
    }

    processDamage(attacker, target, baseAmount, context = {}) {
        if (target.dead || baseAmount <= 0) {
            return { amount: 0, isCrit: false, negated: target.dead ? 'dead' : 'zero' };
        }

        let amount = baseAmount;
        let damageContributions = [];
        
        // Track base damage contribution from the attacker
        if (attacker && baseAmount > 0) {
            damageContributions.push({ source: attacker, amount: baseAmount });
        }

        const missCheck = attacker.trigger('before_damage_delivered', { target, amount, ...context });
        if (missCheck.missed) {
            return { negated: 'miss', amount: 0 };
        }
        const missAmount = missCheck.amount;
        if (missAmount !== undefined && missAmount !== null && !isNaN(missAmount)) {
            amount = missAmount;
        }
        if (missCheck.damageContributions) {
            damageContributions = damageContributions.concat(missCheck.damageContributions);
        }

        const dodgeCheck = target.trigger('before_damage_received', { attacker, amount, ...context });
        if (dodgeCheck.dodged) {
            target.trigger('dodge', { attacker, ...context });
            return { negated: 'dodge', amount: 0 };
        }
        const dodgeAmount = dodgeCheck.amount;
        if (dodgeAmount !== undefined && dodgeAmount !== null && !isNaN(dodgeAmount)) {
            amount = dodgeAmount;
        }
        if (dodgeCheck.damageContributions) {
            damageContributions = damageContributions.concat(dodgeCheck.damageContributions);
        }

        const dodgeChance = target.getConditionalBonus('dodge', { target: attacker });
        if (dodgeChance > 0 && Math.random() * 100 < dodgeChance) {
            target.trigger('dodge', { attacker, ...context });
            return { negated: 'dodge', amount: 0 };
        }

        amount = this._applyPercentBonus(amount, attacker, 'damage_bonus');
        const beforeReduction = amount;
        amount = this._applyPercentReduction(amount, target, 'damage_reduction');
        const damageBlocked = beforeReduction - amount;

        const critResult = this._processCritical(amount, attacker);
        const finalAmount = isNaN(critResult.amount) ? 0 : critResult.amount;

        return {
            amount: finalAmount,
            isCrit: critResult.isCrit,
            negated: false,
            damageContributions,
            damageBlocked
        };
    }

    processHealing(caster, target, baseAmount, context = {}) {
        let amount = baseAmount;

        amount = this._applyPercentBonus(amount, caster, 'healing_bonus');
        amount = this._applyPercentBonus(amount, target, 'healing_received');

        const deliverResult = caster.trigger('before_heal_delivered', { target, amount, ...context });
        const deliverAmount = deliverResult.amount;
        if (deliverAmount !== undefined && deliverAmount !== null && !isNaN(deliverAmount)) {
            amount = deliverAmount;
        }

        const receiveResult = target.trigger('before_heal_received', { caster, amount, ...context });
        const receiveAmount = receiveResult.amount;
        if (receiveAmount !== undefined && receiveAmount !== null && !isNaN(receiveAmount)) {
            amount = receiveAmount;
        }

        return { amount: isNaN(amount) ? 0 : amount };
    }

    processEnergyGain(character, baseEnergy) {
        const bonus = character.getPassiveBonus('energy_gain_bonus');
        return baseEnergy + Math.floor(baseEnergy * (bonus / 100));
    }

    processCostReduction(character, baseCost) {
        const reduction = character.getPassiveBonus('cost_reduction');
        return Math.max(0, baseCost - reduction);
    }

    checkSpellEcho(character) {
        const echoChance = character.getPassiveBonus('spell_echo');
        return echoChance > 0 && Math.random() * 100 < echoChance;
    }

    checkExecute(attacker, target) {
        if (target.dead) return false;
        const threshold = attacker.getPassiveBonus('execute');
        if (threshold > 0 && target.hitpointsPercent < threshold) {
            return true;
        }
        return false;
    }

    calculateReflect(attacker, target, damageDealt) {
        if (damageDealt <= 0) return 0;
        const reflectPercent = target.getPassiveBonus('reflect_damage');
        if (reflectPercent > 0) {
            return Math.ceil(damageDealt * (reflectPercent / 100));
        }
        return 0;
    }

    _processCritical(amount, attacker) {
        const critChance = attacker.getPassiveBonus('crit_chance');
        if (critChance > 0 && Math.random() * 100 < critChance) {
            const critDamage = attacker.getPassiveBonus('crit_damage');
            const multiplier = BASE_CRIT_MULTIPLIER + (critDamage / 100);
            return { amount: Math.ceil(amount * multiplier), isCrit: true };
        }
        return { amount, isCrit: false };
    }

    _applyPercentBonus(amount, character, effectType) {
        const bonus = character.getPassiveBonus(effectType);
        if (bonus > 0) {
            return Math.ceil(amount * (1 + bonus / 100));
        }
        return amount;
    }

    _applyPercentReduction(amount, character, effectType) {
        const reduction = character.getPassiveBonus(effectType);
        if (reduction > 0) {
            return Math.ceil(amount * (1 - reduction / 100));
        }
        return amount;
    }
}

// ============================================================================
// Mastery XP Utilities
// ============================================================================

/**
 * Add mastery XP with bonuses and level cap
 */
function addMasteryXPWithBonus(manager, action, baseXP, options = {}) {
    const { updateTooltip = true, levelCap = 99 } = options;

    const xpBonus = manager.party.getMasteryXPBonus(action);
    let modifiedXP = Math.floor(baseXP * (1 + xpBonus));

    const currentLevel = manager.getMasteryLevel(action);
    if (currentLevel >= levelCap) {
        modifiedXP = 0;
    } else {
        const currentXP = manager.getMasteryXP(action);
        const xpForCap = exp.levelToXP(levelCap + 1) - 1;
        const maxXPToAdd = Math.max(0, xpForCap - currentXP);
        modifiedXP = Math.min(modifiedXP, maxXPToAdd);
    }

    if (modifiedXP <= 0) return 0;

    manager.addMasteryXP(action, modifiedXP);
    manager.addMasteryPoolXP(modifiedXP);

    if(updateTooltip && action.renderQueue) {
        action.renderQueue.tooltip = true;
    }

    return modifiedXP;
}

// ============================================================================
// Registry Helpers
// ============================================================================

/**
 * Get object from registry with optional warning
 */
function getFromRegistry(registry, id, context = 'object', warn = false) {
    if (!registry || !id) return undefined;

    const obj = registry.getObjectByID(id);
    if (!obj && warn) {
        console.warn(`[Adventuring] Unknown ${context}: ${id}`);
    }
    return obj;
}

/**
 * Get object from registry, throw if not found
 */
function requireFromRegistry(registry, id, context = 'object') {
    if (!registry) {
        throw new Error(`[Adventuring] Registry is undefined when looking up ${context}: ${id}`);
    }

    const obj = registry.getObjectByID(id);
    if (!obj) {
        throw new Error(`[Adventuring] Required ${context} not found: ${id}`);
    }
    return obj;
}

// ============================================================================
// Exports
// ============================================================================

export {
    // General utilities
    firstDefined,
    randomElement,
    randomInt,
    rollChance,
    clamp,
    toPercent,
    
    // Media utilities
    UNKNOWN_MEDIA,
    getLockedMedia,
    
    // Combat utilities
    PassiveEffectProcessor,
    
    // Mastery utilities
    addMasteryXPWithBonus,
    
    // Registry helpers
    getFromRegistry,
    requireFromRegistry,
    
    // Re-exports from targeting.mjs
    resolveTargets,
    sortByAgility,
    isInCombat,
    
    // Re-exports from effect-processor.mjs
    createEffect,
    prependSourcePath,
    filterEffects,
    buildEffectContext,
    getPooledContext,
    releaseContext,
    awardCombatXP,
    SimpleEffectInstance,
    getEffectAmount,
    getEffectAmountWithConsumes,
    EffectProcessor,
    defaultEffectProcessor,
    
    // Re-exports from effect-descriptions.mjs
    getAuraName,
    parseDescription,
    describeEffect,
    describeEffectFull,
    describeEffects,
    describeEffectsInline,
    getEffectDescriptionsList,
    formatTrigger,
    formatTriggerSuffix,
    formatTarget,
    joinEffectDescriptions,
    
    // Re-exports from build-description.mjs
    buildEffectReplacements,
    buildHitEffectReplacements,
    buildDescription,
    
    // Re-exports from render-queues.mjs
    AdventuringMasteryRenderQueue,
    AdventuringBadgeRenderQueue,
    AdventuringEquipmentRenderQueue,
    
    // Re-exports from condition-evaluator.mjs
    evaluateCondition,
    describeCondition,
    describeLimitSuffix
}
