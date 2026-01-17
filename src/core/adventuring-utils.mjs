const { loadModule } = mod.getContext(import.meta);

class StatCalculator {

    static calculate(baseValue, bonuses = { flat: 0, percent: 0 }, globalPercent = 0) {
        const flat = bonuses.flat || 0;
        const percent = bonuses.percent || 0;

        const withFlat = baseValue + flat;
        const withPercent = withFlat * (1 + percent / 100);
        const withGlobal = withPercent * (1 + globalPercent / 100);

        return Math.floor(withGlobal);
    }

    static aggregate(target, ...sources) {
        for (const source of sources) {
            if (!source) continue;

            if (typeof source.forEach === 'function') {
                source.forEach((value, stat) => {
                    target.set(stat, (target.get(stat) || 0) + value);
                });
            }
        }
    }

    static calculateWithScaling(target, base, scaling, level, bonusPercent = 0) {
        target.reset();

        base.forEach((value, stat) => target.set(stat, value));

        scaling.forEach((value, stat) => {
            target.set(stat, (target.get(stat) || 0) + Math.floor(level * value));
        });

        if (bonusPercent > 0) {
            target.forEach((value, stat) => {
                const bonus = Math.floor(value * bonusPercent / 100);
                target.set(stat, value + bonus);
            });
        }
    }

    static applyMultiplier(target, multiplier) {
        if (multiplier === 1) return;

        target.forEach((value, stat) => {
            target.set(stat, Math.floor(value * multiplier));
        });
    }
}

class EffectLimitTracker {
    constructor() {

        this.counts = {
            combat: new Map(),
            round: new Map(),
            turn: new Map()
        };
    }

    getKey(effect, source) {
        let sourceId = 'unknown';
        if (source && source.id) {
            sourceId = source.id;
        } else if (source && source.localID) {
            sourceId = source.localID;
        }
        const effectStr = JSON.stringify({
            type: effect.type,
            trigger: effect.trigger,
            id: effect.id,
            stat: effect.stat,
            amount: effect.amount
        });
        return `${sourceId}:${effectStr}`;
    }

    canTrigger(effect, source) {
        if (!effect.limit) return true;

        const key = this.getKey(effect, source);
        const times = effect.times || 1;
        const countMap = this.counts[effect.limit];

        if (!countMap) {
            console.warn(`EffectLimitTracker: Unknown limit type: ${effect.limit}`);
            return true;
        }

        const currentCount = countMap.get(key) || 0;
        return currentCount < times;
    }

    record(effect, source) {
        if (!effect.limit) return;

        const key = this.getKey(effect, source);
        const countMap = this.counts[effect.limit];

        if (!countMap) return;

        const currentCount = countMap.get(key) || 0;
        countMap.set(key, currentCount + 1);
    }

    reset(limitType) {
        if (this.counts[limitType]) {
            this.counts[limitType].clear();
        }
    }

    resetAll() {
        this.counts.combat.clear();
        this.counts.round.clear();
        this.counts.turn.clear();
    }
}

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

        const missCheck = attacker.trigger('before_damage_delivered', { target, amount, ...context });
        if (missCheck.missed) {
            return { negated: 'miss', amount: 0 };
        }
        amount = (missCheck.amount !== undefined && missCheck.amount !== null) ? missCheck.amount : amount;
        if (missCheck.damageContributions) {
            damageContributions = damageContributions.concat(missCheck.damageContributions);
        }

        const dodgeCheck = target.trigger('before_damage_received', { attacker, amount, ...context });
        if (dodgeCheck.dodged) {
            target.trigger('dodge', { attacker, ...context });
            return { negated: 'dodge', amount: 0 };
        }
        amount = (dodgeCheck.amount !== undefined && dodgeCheck.amount !== null) ? dodgeCheck.amount : amount;
        if (dodgeCheck.damageContributions) {
            damageContributions = damageContributions.concat(dodgeCheck.damageContributions);
        }

        const dodgeChance = target.getConditionalBonus('dodge', { target: attacker });
        if (dodgeChance > 0 && Math.random() * 100 < dodgeChance) {
            target.trigger('dodge', { attacker, ...context });
            return { negated: 'dodge', amount: 0 };
        }

        amount = this._applyPercentBonus(amount, attacker, 'damage_bonus');

        amount = this._applyPercentReduction(amount, target, 'damage_reduction');

        const critResult = this._processCritical(amount, attacker);

        return {
            amount: critResult.amount,
            isCrit: critResult.isCrit,
            negated: false,
            damageContributions
        };
    }

    processHealing(caster, target, baseAmount, context = {}) {
        let amount = baseAmount;

        amount = this._applyPercentBonus(amount, caster, 'healing_bonus');

        amount = this._applyPercentBonus(amount, target, 'healing_received');

        const deliverResult = caster.trigger('before_heal_delivered', { target, amount, ...context });
        amount = (deliverResult.amount !== undefined && deliverResult.amount !== null) ? deliverResult.amount : amount;

        const receiveResult = target.trigger('before_heal_received', { caster, amount, ...context });
        amount = (receiveResult.amount !== undefined && receiveResult.amount !== null) ? receiveResult.amount : amount;

        return { amount };
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

function randomElement(array) {
    if(!array || array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollChance(chance) {
    return Math.random() * 100 < chance;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

const UNKNOWN_MEDIA = 'melvor:assets/media/main/question.png';

function getLockedMedia(obj) {
    return obj.unlocked ? obj.getMediaURL(obj._media) : obj.getMediaURL(UNKNOWN_MEDIA);
}

function toPercent(value, max) {
    if(max <= 0) return 0;
    return clamp((value / max) * 100, 0, 100);
}

/** Check if a character is participating in combat (has a combat job that isn't "none") */
function isInCombat(character) {
    // Enemies are always in combat
    if (!character.combatJob) return true;
    return character.combatJob.id !== 'adventuring:none';
}

/**
 * Resolve targets for an effect based on targeting type.
 * Handles both single-target (self/attacker/target) and multi-target (all/front/back/etc).
 * 
 * @param {string} targetType - The targeting type (self, attacker, target, all, front, back, etc.)
 * @param {Object} context - Resolution context
 * @param {Object} context.party - The party to resolve multi-targets from
 * @param {Object} context.self - The source character (for 'self' targeting)
 * @param {Object} context.attacker - The attacker (for 'attacker' targeting)
 * @param {Object} context.target - The target (for 'target' targeting)
 * @param {Object} context.exclude - Character to exclude from multi-targeting
 * @param {boolean} context.allowDead - Whether to include dead targets (for remove effects)
 * @returns {Array} Array of target characters
 */
function resolveTargets(targetType, context) {
    const { party, self, attacker, target, exclude, allowDead } = context;
    
    // Handle single-target types
    switch(targetType) {
        case "self":
            return self && (allowDead || !self.dead) ? [self] : [];
            
        case "attacker":
            return attacker && !attacker.dead ? [attacker] : [];
            
        case "target":
            return target && !target.dead ? [target] : [];
            
        case "none":
            return [];
    }
    
    // Multi-target types require a party
    if (!party) return [];
    
    // Filter to only include combatants (not "none" combat job heroes)
    const alive = party.all.filter(t => !t.dead && t !== exclude && isInCombat(t));

    switch(targetType) {
        case "front": {
            // Check front, then center, then back - but only if they're in combat
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) return [party.front];
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) return [party.center];
            if(!party.back.dead && party.back !== exclude && isInCombat(party.back)) return [party.back];
            return [];
        }

        case "back": {
            // Check back, then center, then front - but only if they're in combat
            if(!party.back.dead && party.back !== exclude && isInCombat(party.back)) return [party.back];
            if(!party.center.dead && party.center !== exclude && isInCombat(party.center)) return [party.center];
            if(!party.front.dead && party.front !== exclude && isInCombat(party.front)) return [party.front];
            return [];
        }

        case "random":
            return alive.length > 0 ? [randomElement(alive)] : [];

        case "lowest": {
            if(alive.length === 0) return [];
            const lowest = alive.reduce((min, t) =>
                (min === undefined || t.hitpointsPercent < min.hitpointsPercent) ? t : min
            , undefined);
            return lowest ? [lowest] : [];
        }

        case "aoe":
        case "all":
            return alive;

        case "dead":
            // Dead targeting still only considers combatants
            return party.all.filter(t => t.dead && t !== exclude && isInCombat(t));

        default:
            return [];
    }
}

function sortByAgility(characters, statsRegistry) {
    const agility = statsRegistry.getObjectByID("adventuring:agility");
    return [...characters].sort((a, b) =>
        b.getEffectiveStat(agility) - a.getEffectiveStat(agility)
    );
}

class AdventuringWeightedTable {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.totalWeight = 0;
        this.table = [];
    }
    get size() {
        return this.table.length;
    }
    get weight() {
        return this.totalWeight;
    }
    get sortedDropsArray() {
        return [...this.table].sort((a,b)=>b.weight - a.weight);
    }
    reset() {
        this.table = [];
        this.totalWeight = 0;
        return this;
    }
    loadTable(data) {
        this.reset();
        data.forEach(({ id, weight, ...rest })=>{
            this.totalWeight += weight;
            this.table.push({
                id,
                weight,
                ...rest
            });
        });
        return this;
    }
    getEntry() {
        const dropRoll = Math.floor(Math.random() * this.totalWeight);
        let itemWeight = 0;
        const lootIndex = this.table.findIndex(({ weight })=> {
            itemWeight += weight;
            return dropRoll < itemWeight;
        });
        const drop = this.table[lootIndex];

        if (drop && drop.qty === undefined && drop.minQty !== undefined && drop.maxQty !== undefined) {
            drop.qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
        }

        return drop;
    }
}

function createEffect(effectData, source, sourceName, sourceType = null) {
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
        source: source,
        sourceName: sourceName,
        sourceType: sourceType
    };
}

const contextPool = [];
const MAX_POOL_SIZE = 16;

function getPooledContext() {
    return contextPool.pop() || {};
}

function releaseContext(ctx) {
    if (!ctx || contextPool.length >= MAX_POOL_SIZE) return;

    for (const key in ctx) {
        if (Object.prototype.hasOwnProperty.call(ctx, key)) {
            ctx[key] = undefined;
        }
    }
    contextPool.push(ctx);
}

function buildEffectContext(character, extra = {}, pooledCtx = null) {

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
 * Filters an array of effects based on provided criteria
 * @param {Array} effects - Array of effect objects
 * @param {Object} filters - Filter criteria
 * @param {string} [filters.trigger] - Filter by trigger type ('passive', 'hit', 'round_end', etc.)
 * @param {string} [filters.party] - Filter by party target ('self', 'enemy', 'ally')
 * @param {string} [filters.type] - Filter by effect type ('stat_flat', 'heal_flat', etc.)
 * @param {string} [filters.stat] - Filter by stat id
 * @param {string} [filters.target] - Filter by target ('self', 'lowest', 'all', etc.)
 * @param {string} [filters.scope] - Filter by scope ('individual', 'party'). 'individual' also matches undefined scope.
 * @returns {Array} Filtered effects
 */
function filterEffects(effects, filters = {}) {
    if (!filters || Object.keys(filters).length === 0) {
        return effects;
    }
    
    return effects.filter(effect => {
        if (filters.trigger !== undefined && effect.trigger !== filters.trigger) return false;
        if (filters.party !== undefined && effect.party !== filters.party) return false;
        if (filters.type !== undefined && effect.type !== filters.type) return false;
        if (filters.stat !== undefined && effect.stat !== filters.stat) return false;
        if (filters.target !== undefined && effect.target !== filters.target) return false;
        // Scope filter: 'individual' matches both 'individual' and undefined (default to individual)
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

class EffectCache {
    constructor() {

        this.sources = new Map();

        this.dirtyFlags = new Map();

        this.cachedByTrigger = new Map();

        this.allEffectsCache = null;

        this.bonusCache = new Map();

        this.globalDirty = true;
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
        if(this.dirtyFlags.has(sourceId)) {
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
        if(!this.globalDirty) return;

        const allEffects = [];

        this.sources.forEach((source, sourceId) => {
            try {
                const effects = source.getEffects();
                if(Array.isArray(effects)) {
                    allEffects.push(...effects);
                }
            } catch(e) {
                console.warn(`EffectCache: Error getting effects from ${sourceId}:`, e);
            }
            this.dirtyFlags.set(sourceId, false);
        });

        this.allEffectsCache = allEffects;
        this.globalDirty = false;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
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

        // For complex filters, compute on demand (could add caching later if needed)
        return filterEffects(this.allEffectsCache || [], filters);
    }

    getBonus(effectType, filter = {}) {
        this.rebuild();

        const filterKey = Object.keys(filter).length > 0
            ? ':' + Object.entries(filter).sort().map(([k,v]) => `${k}=${v}`).join(',')
            : '';
        const cacheKey = `bonus:${effectType}${filterKey}`;

        if(this.bonusCache.has(cacheKey)) {
            return this.bonusCache.get(cacheKey);
        }

        const passiveEffects = this.getEffects('passive');
        const total = passiveEffects
            .filter(e => {
                if(e.type !== effectType) return false;

                for(const [key, value] of Object.entries(filter)) {
                    if(e[key] !== value) return false;
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

    getStatBonus(statId) {
        this.rebuild();

        const cacheKey = `stat:${statId}`;
        if(this.bonusCache.has(cacheKey)) {
            return this.bonusCache.get(cacheKey);
        }

        const passiveEffects = this.getEffects('passive');
        let flat = 0;
        let percent = 0;

        passiveEffects.forEach(e => {
            if(e.stat === statId) {
                if(e.type === 'stat_flat') {
                    flat += e.value || 0;
                } else if(e.type === 'stat_percent') {
                    percent += e.value || 0;
                }
            }
        });

        const result = { flat, percent };
        this.bonusCache.set(cacheKey, result);
        return result;
    }

    /**
     * Get stat bonuses organized by source ID for breakdown display
     * @param {string} statId - The stat ID to get bonuses for
     * @returns {Map<string, {flat, percent, effects}>} sourceId → bonus data with individual effects
     */
    getStatBonusBySource(statId) {
        this.rebuild();
        
        const bySource = new Map();
        
        this.sources.forEach((source, sourceId) => {
            // Skip auras - they're handled separately for combat effects
            if (sourceId === 'auras') return;
            
            try {
                const effects = source.getEffects();
                if (!Array.isArray(effects)) return;

                let flat = 0;
                let percent = 0;
                const matchingEffects = [];

                for (const effect of effects) {
                    if (effect.trigger !== 'passive') continue;
                    
                    let matches = false;
                    let value = effect.value ?? effect.amount ?? 0;
                    
                    // Handle stat_flat and stat_percent for this stat
                    if ((effect.type === 'stat_flat' || effect.type === 'stat_percent') && effect.stat === statId) {
                        matches = true;
                        if (effect.type === 'stat_flat') {
                            flat += value;
                        } else {
                            percent += value;
                        }
                    }
                    
                    // Handle all_stat_bonus (applies to every stat)
                    if (effect.type === 'all_stat_bonus') {
                        matches = true;
                        flat += value;
                    }
                    
                    if (matches) {
                        matchingEffects.push({
                            sourceName: effect.sourceName || sourceId,
                            sourceRef: effect.source,
                            flat: effect.type === 'stat_flat' || effect.type === 'all_stat_bonus' ? value : 0,
                            percent: effect.type === 'stat_percent' ? value : 0
                        });
                    }
                }

                if (flat !== 0 || percent !== 0) {
                    bySource.set(sourceId, { flat, percent, effects: matchingEffects });
                }
            } catch (e) {
                console.warn(`EffectCache.getStatBonusBySource: Error processing source ${sourceId}:`, e);
            }
        });

        return bySource;
    }

    clear() {
        this.allEffectsCache = null;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
        this.globalDirty = true;
    }

    getConditionalBonus(effectType, context) {
        this.rebuild();

        const passiveEffects = this.getEffects('passive');
        return passiveEffects
            .filter(e => {
                if (e.type !== effectType) return false;

                if (e.condition) {
                    return evaluateCondition(e.condition, context);
                }
                return true;
            })
            .reduce((sum, e) => {
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
            const sourceConfig = this.sources.get(effect.sourceType);
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
        const { source, sourceName, sourceType } = effect;

        // Compute amount - handle both static and dynamic
        let amount = effect.amount || 0;
        if (typeof effect.getAmount === 'function') {
            amount = effect.getAmount(host);
        }

        // Compute stacks - handle both static and dynamic
        let stacks = effect.stacks || 1;
        if (typeof effect.getStacks === 'function') {
            stacks = effect.getStacks(host);
        }

        // Build processor context and apply
        const processorContext = {
            character: host,
            caster: host,
            manager: host?.manager || context?.manager,
            extra: context
        };
        
        return defaultEffectProcessor.processEffect(effect, amount, stacks, sourceName, processorContext);
    }
}

class RequirementsChecker {

    constructor(manager, requirements = []) {
        this.manager = manager;
        this.requirements = requirements;
    }

    check(context = {}) {
        if(!this.requirements || this.requirements.length === 0) return true;
        return this.requirements.every(req => this.checkSingle(req, context));
    }

    checkSingle(req, context = {}) {

        if(!req || !req.type) {
            console.warn(`Malformed requirement:`, req);
            return true;
        }

        const { character } = context;

        switch(req.type) {
            case 'skill_level':
                return this.manager.level >= req.level;

            case 'melvor_skill_level': {

                const skill = this.manager.game.skills.getObjectByID(req.skill);
                if (!skill) {
                    console.warn(`[Adventuring] Unknown Melvor skill: ${req.skill}`);
                    return true; // Don't block if skill not found
                }
                return skill.level >= req.level;
            }

            case 'job_level':
                return this._checkJobLevel(req.job, req.level);

            case 'current_job_level':
                return this._checkCurrentJobLevel(req.job, req.level, character);

            case 'slayer_tasks_completed': {
                const totalTasks = this.manager.slayers !== undefined ? this.manager.slayers.totalTasksCompleted : 0;
                return totalTasks >= req.count;
            }

            case 'current_job':
                return this._hasCurrentJob(req.job, character);

            case 'dead':
                return character !== undefined ? character.dead : false;

            case 'comparison':
                return this._checkComparison(req, character);

            case 'area_mastery': {
                const area = this.manager.areas.getObjectByID(req.area);
                return area ? this.manager.getMasteryLevel(area) >= req.level : false;
            }

            case 'item_upgrade': {
                const item = this.manager.baseItems.getObjectByID(req.item);
                return item ? item.upgradeLevel >= req.level : false;
            }

            case 'achievement_completion': {

                if (this.manager.achievements === undefined) return false;
                const achievement = this.manager.achievements.getObjectByID(req.id);
                return achievement ? achievement.isComplete() : false;
            }

            case 'achievement_milestone': {
                // Check if a specific milestone in a milestone chain achievement is complete
                if (this.manager.achievements === undefined) return false;
                const achievement = this.manager.achievements.getObjectByID(req.achievement);
                if (!achievement) return false;
                // If the achievement has milestones, check the specific milestone
                if (achievement.isMilestoneChain) {
                    return achievement.isMilestoneComplete(req.milestone);
                }
                // Fallback: if not a milestone chain, check if achievement is complete
                return achievement.isComplete();
            }

            case 'area_cleared': {

                const area = this.manager.areas.getObjectByID(req.area);
                if (!area) return false;
                let xp = 0;
                if (this.manager.actionMastery) {
                    const masteryEntry = this.manager.actionMastery.get(area);
                    if (masteryEntry && masteryEntry.xp) {
                        xp = masteryEntry.xp;
                    }
                }
                return xp > 0;
            }

            case 'dropped':

                return context.item && context.item.dropped === true;

            case 'always_false':

                return false;

            case 'is_solo': {
                // Requirement is met if party has only one active combatant
                if (!this.manager.party) return false;
                const party = this.manager.party.all || [];
                if (party.length === 0) return false;
                const noneJobId = 'adventuring:none';
                const activeCombatants = party.filter(h => 
                    h.combatJob && h.combatJob.id !== noneJobId
                );
                return activeCombatants.length === 1;
            }

            default:
                console.warn(`Unknown requirement type: ${req.type}`);
                return false; // Fail safe: unknown requirements should block, not pass
        }
    }

    _checkJobLevel(jobId, level) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return false;
        return this.manager.getMasteryLevel(job) >= level;
    }

    _checkCurrentJobLevel(jobId, level, character) {
        if(!character) return this._checkJobLevel(jobId, level);

        const hasCombatJob = character.combatJob !== undefined && character.combatJob.id === jobId;
        const hasPassiveJob = character.passiveJob !== undefined && character.passiveJob.id === jobId;

        if(!hasCombatJob && !hasPassiveJob) return false;

        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return false;
        return this.manager.getMasteryLevel(job) >= level;
    }

    _hasCurrentJob(jobId, character) {
        if(!character) return false;
        const combatMatch = character.combatJob !== undefined && character.combatJob.id === jobId;
        const passiveMatch = character.passiveJob !== undefined && character.passiveJob.id === jobId;
        return combatMatch || passiveMatch;
    }

    _checkComparison(req, character) {
        let value;

        const property = req.property;
        const target = req.value;

        switch(property) {
            case 'hitpoints_percent':
                if(!character) return false;
                value = character.hitpointsPercent;
                break;
            case 'hitpoints':
                if(!character) return false;
                value = character.hitpoints;
                break;
            case 'energy':
                if(!character) return false;
                value = character.energy;
                break;
            case 'material_count': {
                const material = this.manager.materials.getObjectByID(req.material);
                if(!material) return false;
                const count = this.manager.stash.materialCounts.get(material);
                value = count !== undefined ? count : 0;
                break;
            }
            default:
                return false;
        }

        const op = req.operator;
        switch(op) {
            case '<':
                return value < target;
            case '<=':
                return value <= target;
            case '>':
                return value > target;
            case '>=':
                return value >= target;
            case '==':
                return value === target;
            default:
                return false;
        }
    }

    referencesJob(jobId) {
        return this.requirements.some(req =>
            (req.type === 'job_level' || req.type === 'current_job_level') &&
            req.job === jobId
        );
    }
}

function formatRequirement(req, manager, context = {}) {
    const checker = new RequirementsChecker(manager, [req]);
    const met = checker.check(context);
    let text = '';

    switch(req.type) {
        case 'skill_level':
            text = `Adventuring Level ${req.level}`;
            break;

        case 'melvor_skill_level': {
            const skill = manager.game.skills.getObjectByID(req.skill);
            const skillName = skill !== undefined ? skill.name : req.skill;
            text = `${skillName} Level ${req.level}`;
            break;
        }

        case 'job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `${jobName} Level ${req.level}`;
            break;
        }

        case 'current_job': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `Requires ${jobName} equipped`;
            break;
        }

        case 'current_job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job !== undefined ? job.name : req.job;
            text = `${jobName} Level ${req.level} (equipped)`;
            break;
        }

        case 'area_mastery': {
            const area = manager.areas.getObjectByID(req.area);
            if (area && !area.unlocked) {
                text = 'Explore to discover unlock requirement';
            } else {
                const areaName = area !== undefined ? area.name : req.area;
                text = `${areaName} Mastery ${req.level}`;
            }
            break;
        }

        case 'item_upgrade': {
            const item = manager.baseItems.getObjectByID(req.item);
            const itemName = item !== undefined ? item.name : req.item;
            text = `${itemName} +${req.level}`;
            break;
        }

        case 'slayer_tasks_completed':
            text = `${req.count} Slayer Tasks Completed`;
            break;

        case 'comparison': {
            const operand = req.property || req.operand;
            const target = req.value !== undefined ? req.value : req.amount;
            const opSymbol = { '<': '<', 'lt': '<', '>': '>', 'gt': '>', '==': '=', 'eq': '=' }[req.operator] || req.operator;
            text = `${operand.replace(/_/g, ' ')} ${opSymbol} ${target}`;
            break;
        }

        case 'area_cleared': {
            const area = manager.areas.getObjectByID(req.area);
            const areaName = area !== undefined ? area.name : req.area;
            text = `Clear ${areaName}`;
            break;
        }

        case 'dropped': {

            const monsters = manager?.equipmentSources?.get(context?.item);
            if (monsters && monsters.length > 0) {

                const monsterSources = manager?.monsterSources;
                const areaSet = new Set();

                for (const monster of monsters) {
                    const areas = monsterSources?.get(monster) || [];
                    for (const area of areas) {
                        areaSet.add(area);
                    }
                }

                const allAreas = [...areaSet];
                const unlockedAreas = allAreas.filter(a => a.unlocked);
                const hasLockedAreas = unlockedAreas.length < allAreas.length;

                if (unlockedAreas.length === 0) {

                    text = 'Explore to discover drop sources';
                } else if (unlockedAreas.length <= 3) {
                    text = `Drops in: ${unlockedAreas.map(a => a.name).join(', ')}`;
                    if (hasLockedAreas) {
                        text += ' (explore for more)';
                    }
                } else {
                    text = `Drops in: ${unlockedAreas.slice(0, 3).map(a => a.name).join(', ')} +${unlockedAreas.length - 3} more`;
                    if (hasLockedAreas) {
                        text += ' (explore for more)';
                    }
                }
            } else {
                text = 'Explore to discover drop sources';
            }
            break;
        }

        case 'always_false':
            text = req.hint || 'Special unlock required';
            break;

        case 'achievement_completion': {
            const achievement = manager.achievements?.getObjectByID(req.id);
            const achievementName = achievement !== undefined ? achievement.name : req.id;
            text = `Complete: ${achievementName}`;
            break;
        }

        case 'achievement_milestone': {
            const achievement = manager.achievements?.getObjectByID(req.achievement);
            if (achievement && achievement.isMilestoneChain) {
                const milestone = achievement.getMilestone(req.milestone);
                const milestoneName = milestone ? milestone.name : req.milestone;
                text = `Complete: ${milestoneName}`;
            } else {
                text = `Complete: ${req.achievement} (${req.milestone})`;
            }
            break;
        }

        case 'is_solo':
            text = 'Solo adventurer only';
            break;

        default:
            text = `${req.type}: ${req.level || req.value || '?'}`;
    }

    return { text, met };
}

function formatRequirements(requirements, manager, context = {}) {
    if(!requirements || requirements.length === 0) return [];
    return requirements.map(req => formatRequirement(req, manager, context));
}

function evaluateCondition(condition, context) {
    if(!condition) return true; // No condition = always true

    const { character, target, manager } = context;

    switch(condition.type) {
        case 'hp_below': {
            if(!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            return hpPercent < (condition.threshold || 30);
        }

        case 'hp_above': {
            if(!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            return hpPercent > (condition.threshold || 50);
        }

        case 'missing_hp': {
            if(!character) return false;
            const missingHp = character.maxHitpoints - character.hitpoints;
            return missingHp >= (condition.min || 1);
        }

        case 'has_buff': {
            if(!character || !character.auras) return false;
            return character.auras.has(condition.id);
        }

        case 'has_debuff': {
            if(!character || !character.auras) return false;
            return character.auras.has(condition.id);
        }

        case 'buff_stacks': {
            if(!character || !character.auras) return false;
            const aura = character.auras.get(condition.id);
            return aura && aura.stacks >= (condition.min || 1);
        }

        case 'enemy_hp_below': {
            if(!target) return false;
            const hpPercent = (target.hitpoints / target.maxHitpoints) * 100;
            return hpPercent < (condition.threshold || 25);
        }

        case 'enemy_hp_above': {
            if(!target) return false;
            const hpPercent = (target.hitpoints / target.maxHitpoints) * 100;
            return hpPercent > (condition.threshold || 50);
        }

        case 'chance': {
            const roll = Math.random() * 100;
            return roll < (condition.value || 0);
        }

        case 'is_injured': {
            if(!character) return false;
            return character.hitpoints < character.maxHitpoints;
        }

        case 'is_full_hp': {
            if(!character) return false;
            return character.hitpoints >= character.maxHitpoints;
        }

        case 'any_ally_injured': {
            if(!context.party) return false;
            return context.party.some(member =>
                !member.dead && member.hitpoints < member.maxHitpoints
            );
        }

        case 'all_allies_alive': {
            if(!context.party) return false;
            return context.party.every(member => !member.dead);
        }

        case 'hp_crossed_below': {
            if(!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            const hpBefore = (context.hpPercentBefore !== undefined) ? context.hpPercentBefore : 100;
            const threshold = condition.threshold || 30;
            return hpBefore >= threshold && hpPercent < threshold;
        }

        case 'hp_crossed_above': {
            if(!character) return false;
            const hpPercent = (character.hitpoints / character.maxHitpoints) * 100;
            const hpBefore = (context.hpPercentBefore !== undefined) ? context.hpPercentBefore : 0;
            const threshold = condition.threshold || 50;
            return hpBefore < threshold && hpPercent >= threshold;
        }

        case 'is_solo': {
            // Check if character is the only active combatant in the party
            if(!context.party && !manager) return false;
            const party = context.party || (manager && manager.party ? manager.party.all : []);
            if(!party || party.length === 0) return false;
            const noneJobId = 'adventuring:none';
            const activeCombatants = party.filter(h => 
                h.combatJob && h.combatJob.id !== noneJobId
            );
            return activeCombatants.length === 1;
        }

        default:
            console.warn(`Unknown condition type: ${condition.type}`);
            return true;
    }
}

function describeCondition(condition, manager) {
    if(!condition) return '';

    const auraName = (auraId) => {
        if (manager === undefined) return auraId || 'Unknown';
        let aura = undefined;
        if (manager.auras !== undefined) aura = manager.auras.getObjectByID(auraId);
        if (aura === undefined && manager.buffs !== undefined) aura = manager.buffs.getObjectByID(auraId);
        if (aura === undefined && manager.debuffs !== undefined) aura = manager.debuffs.getObjectByID(auraId);
        return aura !== undefined ? aura.name : (auraId || 'Unknown');
    };

    switch(condition.type) {
        case 'hp_below':
            return `when below ${condition.threshold}% HP`;
        case 'hp_above':
            return `when above ${condition.threshold}% HP`;
        case 'missing_hp':
            return `when missing ${condition.min}+ HP`;
        case 'has_buff':
            return `while has ${auraName(condition.id)}`;
        case 'has_debuff':
            return `while has ${auraName(condition.id)}`;
        case 'buff_stacks':
            return `with ${condition.min}+ ${auraName(condition.id)} stacks`;
        case 'enemy_hp_below':
            return `vs enemies below ${condition.threshold}% HP`;
        case 'enemy_hp_above':
            return `vs enemies above ${condition.threshold}% HP`;
        case 'chance':
            return `(${condition.value}% chance)`;
        case 'is_injured':
            return `when injured`;
        case 'is_full_hp':
            return `at full HP`;
        case 'any_ally_injured':
            return `if any ally is injured`;
        case 'all_allies_alive':
            return `if all allies are alive`;
        case 'hp_crossed_below':
            return `when dropping below ${condition.threshold}% HP`;
        case 'hp_crossed_above':
            return `when rising above ${condition.threshold}% HP`;
        case 'is_solo':
            return `while adventuring solo`;
        default:
            return condition.type;
    }
}

function describeLimitSuffix(limitType, times) {
    if (!limitType) return '';

    const timesText = times === 1 ? 'once' : `${times} times`;

    switch(limitType) {
        case 'combat':
        case 'encounter':
            return `(${timesText} per encounter)`;
        case 'round':
            return `(${timesText} per round)`;
        case 'turn':
            return `(${timesText} per turn)`;
        default:
            return `(${timesText} per ${limitType})`;
    }
}

function parseDescription(template, replacements) {
    if(!template) return '';

    let result = template;
    for(const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

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

function firstDefined(...values) {
    for (let i = 0; i < values.length; i++) {
        if (values[i] !== undefined) return values[i];
    }
    return values[values.length - 1];
}

const effectDescriptionRegistry = new Map([

    ['stat_flat', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 1);
        const absV = Math.abs(v);
        return effect.perStack
            ? `${helpers.sign(v)}${absV} ${helpers.stat(effect.stat)} per stack`
            : `${helpers.sign(v)}${absV} ${helpers.stat(effect.stat)}`;
    }],
    ['stat_percent', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 1);
        const absV = Math.abs(v);
        return effect.perStack
            ? `${helpers.sign(v)}${absV}% ${helpers.stat(effect.stat)} per stack`
            : `${helpers.sign(v)}${absV}% ${helpers.stat(effect.stat)}`;
    }],

    ['damage_flat', (effect, value, stacks, amount, manager, helpers) =>
        effect.perStack ? `Deal ${firstDefined(value, amount, 1)} damage per stack` : `Deal ${firstDefined(value, amount, '?')} damage`],
    ['heal_flat', (effect, value, stacks, amount, manager, helpers) =>
        effect.perStack ? `Heal ${firstDefined(value, amount, effect.count, 1)} HP per stack` : `Heal ${firstDefined(value, amount, effect.count, '?')} HP`],
    ['heal_percent', (effect, value, stacks, amount, manager, helpers) =>
        `Restore ${helpers.percent(firstDefined(value, amount))}% HP`],
    ['lifesteal', (effect, value, stacks, amount, manager, helpers) =>
        effect.perStack
            ? `Heal ${helpers.percent(firstDefined(value, amount, 0))}% of damage per stack`
            : `Heal for ${helpers.percent(firstDefined(value, amount, 0))}% of damage dealt`],

    ['damage_modifier_flat', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 1);
        const absV = Math.abs(v);
        return effect.perStack ? `${helpers.sign(v)}${absV} Damage per stack` : `${helpers.sign(v)}${absV} Damage`;
    }],
    ['damage_modifier_percent', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 1);
        const absV = Math.abs(v);
        return effect.perStack ? `${helpers.sign(v)}${absV}% Damage per stack` : `${helpers.sign(v)}${absV}% Damage`;
    }],

    ['buff', (effect, value, stacks, amount, manager, helpers) => {
        if (effect.random) {
            const count = firstDefined(effect.count, 1);
            const stackCount = firstDefined(stacks, 1);
            return count === 1
                ? `Apply a random buff (${stackCount} stack${stackCount !== 1 ? 's' : ''})`
                : `Apply ${count} random buffs (${stackCount} stack${stackCount !== 1 ? 's' : ''} each)`;
        }
        return `Apply ${firstDefined(stacks, 1)} ${helpers.aura(effect.id)}`;
    }],
    ['debuff', (effect, value, stacks, amount, manager, helpers) => {
        if (effect.random) {
            const count = firstDefined(effect.count, 1);
            const stackCount = firstDefined(stacks, 1);
            return count === 1
                ? `Apply a random debuff (${stackCount} stack${stackCount !== 1 ? 's' : ''})`
                : `Apply ${count} random debuffs (${stackCount} stack${stackCount !== 1 ? 's' : ''} each)`;
        }
        return `Apply ${firstDefined(stacks, 1)} ${helpers.aura(effect.id)}`;
    }],
    ['cleanse', (effect, value, stacks, amount, manager, helpers) =>
        effect.id ? `Remove ${helpers.aura(effect.id)}` : 'Cleanse debuffs'],

    ['energy', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 0);
        const absV = Math.abs(v);
        return `${helpers.sign(v)}${absV} Energy`;
    }],

    ['xp_percent', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 0);
        const absV = Math.abs(v);
        if (effect.category) {
            const catId = effect.category;

            const catName = catId.includes(':') ? catId.split(':').pop() : catId;
            const label = catName.charAt(0).toUpperCase() + catName.slice(1);
            return `${helpers.sign(v)}${absV}% ${label} XP`;
        }
        return `${helpers.sign(v)}${absV}% XP`;
    }],
    ['loot_percent', (effect, value, stacks, amount, manager, helpers) => {
        const v = firstDefined(value, amount, 0);
        const absV = Math.abs(v);
        return `${helpers.sign(v)}${absV}% Loot`;
    }],

    ['revive', (effect, value, stacks, amount) =>
        `Revive with ${amount || 100}% HP`],

    ['work', () => 'Work in town job building'],

    ['teleport', () => 'Teleport to a random tile'],
    ['loot', () => 'Contains random loot'],
    ['xp', (effect, value, stacks, amount, manager, helpers) => `Grant ${firstDefined(amount, value)} Job XP`],

    ['damage_percent', (effect, value, stacks, amount, manager, helpers) =>
        `Deal ${firstDefined(amount, value)}% HP damage`],
    ['damage_bonus', (effect, value, stacks, amount, manager, helpers) =>
        `+${helpers.percent(value)}% damage`],
    ['damage_reduction', (effect, value, stacks, amount, manager, helpers) =>
        `${helpers.percent(value)}% damage reduction`],

    ['immune', (effect, value, stacks, amount, manager, helpers) => {
        return effect.id ? `Immune to ${helpers.aura(effect.id)}` : 'Immune to debuffs';
    }],

    ['crit_chance', (effect, value, stacks, amount, manager, helpers) =>
        `+${helpers.percent(value)}% critical chance`],
    ['crit_damage', (effect, value, stacks, amount, manager, helpers) =>
        `+${helpers.percent(value)}% critical damage`],

    ['cost_reduction', (effect, value, stacks, amount, manager, helpers) =>
        `-${helpers.percent(value)}% ability cost`],

    ['healing_bonus', (effect, value, stacks, amount, manager, helpers) =>
        `+${helpers.percent(value)}% healing done`],
    ['healing_received', (effect, value, stacks, amount, manager, helpers) =>
        `+${helpers.percent(value)}% healing received`],

    ['reflect', (effect, value, stacks, amount, manager, helpers) =>
        effect.perStack
            ? `Reflect ${helpers.percent(firstDefined(amount, value))}% damage per stack`
            : `Reflect ${helpers.percent(firstDefined(value, amount))}% damage taken`],

    ['execute', (effect, value, stacks, amount, manager, helpers) => {
        let threshold = firstDefined(effect.threshold, value, 0.2);

        if (threshold > 0 && threshold < 1) threshold = Math.round(threshold * 100);
        return `Execute enemies below ${threshold}% HP`;
    }],

    ['all_stat_percent', (effect, value, stacks, amount, manager, helpers) => {
        if (effect.party === 'enemy') return `+${value}% enemy stats`;
        if (effect.party === 'hero') return `+${value}% party stats`;
        return `+${value}% all stats`;
    }],

    ['dispel', (effect, value, stacks, amount, manager, helpers) => {
        if (effect.id) return `Remove ${helpers.aura(effect.id)} from target`;
        const dispelCount = effect.count || 1;
        return dispelCount === 'all' ? 'Remove all buffs from target' : `Remove ${dispelCount} buff${dispelCount !== 1 ? 's' : ''} from target`;
    }],

    ['unlock', (effect) => {
        const unlockType = effect.unlockType || 'unknown';
        switch (unlockType) {
            case 'auto_run': return 'Unlock Auto-Run';
            case 'area_drops_reveal': return 'Reveal Area Drops';
            case 'drop_table_reveal': return 'Reveal Monster Drops';
            case 'difficulty': {
                const diffParts = effect.difficultyID ? effect.difficultyID.split(':') : [];
                const diffId = diffParts.length > 0 ? diffParts[diffParts.length - 1] : 'Unknown';
                return `Unlock ${diffId.charAt(0).toUpperCase() + diffId.slice(1)} Mode`;
            }
            case 'mastery_aura': return 'Unlock Mastery Aura';
            case 'multi_job_assignment': return 'Unlock Multi-Job Assignment';
            case 'mastered_variant': return 'Unlock Mastered Variant';
            default: return `Unlock ${unlockType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
        }
    }],

    ['job_stats_percent', (effect, value) => `+${value}% Job Stats`],
    ['drop_rate_percent', (effect, value) => `+${value}% Drop Rate`],
    ['drop_quantity_percent', (effect, value) => `+${value}% Drop Quantity`],
    ['currency_drop_percent', (effect, value) => `+${value}% Currency Drops`],
    ['explore_speed_percent', (effect, value) => `+${value}% Explore Speed`],
    ['spawn_rate_percent', (effect, value) => {
        const spawnType = effect.spawnType || 'unknown';
        const label = spawnType.charAt(0).toUpperCase() + spawnType.slice(1);
        return `${value > 0 ? '+' : ''}${value}% ${label} Spawn Rate`;
    }],
    ['ability_learn_chance_percent', (effect, value) => `+${value}% Ability Learn Chance`],
    ['equipment_xp_percent', (effect, value) => `+${value}% Equipment XP`],
    ['upgrade_cost_percent', (effect, value) => `${value > 0 ? '+' : ''}${value}% Upgrade Cost`],
    ['equipment_stats_percent', (effect, value) => `+${value}% Equipment Stats`],
    ['category_xp_percent', (effect, value) => `+${value}% Category Mastery XP`],

    ['remove', () => 'Remove aura'],
    ['remove_stacks', (effect, value, stacks, amount) => {
        const count = Math.max(1, Math.ceil(firstDefined(effect.count, amount, 1)));
        return `Remove ${count} stack${count !== 1 ? 's' : ''}`;
    }],
    ['consume_charge', (effect) => `Consume ${firstDefined(effect.count, 1)} charge(s)`],
    ['absorb', (effect, value, stacks, amount) => `Absorb ${firstDefined(amount, 1)} damage per stack`],
    ['skip', (effect, value, stacks, amount) => {
        if (effect.condition && effect.condition.type === 'chance') return `${effect.condition.value}% chance to skip turn`;
        return 'Skip turn';
    }],
    ['dodge', (effect, value, stacks, amount) => {

        const dodgeAmount = firstDefined(amount, effect.amount);
        if (dodgeAmount !== undefined) return `+${dodgeAmount}% dodge chance`;

        if (effect.condition && effect.condition.type === 'chance') return `${effect.condition.value}% chance to dodge`;
        if (effect.condition && effect.condition.type === 'hp_below') return `Dodge attacks when HP below ${effect.condition.threshold}%`;
        return 'Dodge attack';
    }],
    ['miss', (effect, value, stacks, amount) => {
        if (effect.condition && effect.condition.type === 'chance') return `${effect.condition.value}% chance to miss`;
        return 'Attack misses';
    }],
    ['confuse', (effect, value, stacks, amount) => {
        if (effect.condition && effect.condition.type === 'chance') return `${effect.condition.value}% chance to hit ally instead`;
        return 'Hit ally instead';
    }],
    ['untargetable', () => 'Cannot be targeted'],
    ['evade', () => 'Evade next attack'],
    ['force_target', () => 'Force enemies to target this character'],
    ['prevent_ability', () => 'Cannot use spenders'],
    ['prevent_debuff', () => 'Immune to next debuff'],
    ['prevent_lethal', () => 'Cannot be killed'],
    ['prevent_death', (effect, value, stacks, amount) => {
        if(amount > 0) {
            return `Survive lethal damage and heal ${amount}% HP`;
        }
        return 'Survive lethal damage once';
    }],
    ['reduce_damage_percent', (effect, value, stacks, amount) =>
        `${firstDefined(amount, 0)}% damage reduction${effect.perStack ? ' per stack' : ''}`],
    ['reduce_heal_percent', (effect, value, stacks, amount) =>
        `-${firstDefined(amount, 0)}% healing received${effect.perStack ? ' per stack' : ''}`],

    ['double_cast', (effect, value, stacks, amount, manager, helpers) => {
        if (effect.condition && effect.condition.type === 'chance') return `${effect.condition.value}% chance to cast spells twice`;
        return `${firstDefined(effect.chance, amount, value)}% chance to cast spells twice`;
    }],
]);

function describeEffect(effect, manager, displayMode = false) {
    if(!effect) return '';
    if (effect.describe === false) return '';

    if(effect.description) return effect.description;

    const sign = (val) => val >= 0 ? '+' : '-';

    const toPercent = (val) => {
        if (val === undefined || val === null) return 0;
        return Math.abs(val) < 1 && val !== 0 ? Math.round(val * 100) : val;
    };

    const getVal = (key) => {
        const raw = effect[key];
        if (raw === undefined || raw === null) return undefined;

        if (typeof raw !== 'object') return raw;

        const methodName = key === 'amount' ? 'getAmount' : key === 'stacks' ? 'getStacks' : null;
        if (methodName && typeof effect[methodName] === 'function') {

            return effect[methodName](null, displayMode !== false ? displayMode : 'multiplier');
        }

        if (raw.base !== undefined) return raw.base;

        return raw;
    };

    const amount = getVal('amount');
    const stacks = getVal('stacks');
    const value = amount; // 'amount' is the canonical property

    const statName = (statId) => {
        if (!manager || !manager.stats) return null;
        const stat = manager.stats.getObjectByID(statId);

        return (stat && stat.name) ? stat.name : null;
    };

    const prettifyStatId = (statId) => {

        if (statId === 'all') return 'All Stats';
        if (!statId) return 'Unknown';
        const parts = statId.split(':');
        const lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
        return lastPart ? lastPart.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    };

    const getStatDisplay = (statId) => statName(statId) || prettifyStatId(statId);
    const auraName = (auraId) => {
        if (!manager || !manager.auras) return prettifyStatId(auraId);

        let aura = manager.auras.getObjectByID(auraId);

        if (!aura && auraId && !auraId.includes(':')) {
            aura = manager.auras.getObjectByID(`adventuring:${auraId}`);
        }
        return (aura && aura.name) ? aura.name : prettifyStatId(auraId);
    };

    const helpers = {
        sign,
        percent: toPercent,
        stat: getStatDisplay,
        aura: auraName,
        prettify: prettifyStatId
    };

    const describer = effectDescriptionRegistry.get(effect.type);
    if (describer) {
        return describer(effect, value, stacks, amount, manager, helpers);
    }

    if (amount !== undefined) {
        return `${effect.type}: ${amount}`;
    }
    return effect.type || 'Unknown effect';
}

function formatTrigger(trigger) {
    if(!trigger) return '';

    const triggerNames = {
        'passive': 'Passive',
        'turn_start': 'At turn start',
        'turn_end': 'At turn end',
        'round_start': 'At round start',
        'round_end': 'At round end',

        'before_damage_received': 'Before receiving damage',
        'after_damage_received': 'After receiving damage',
        'before_damage_delivered': 'Before dealing damage',
        'after_damage_delivered': 'After dealing damage',
        'miss': 'On miss',
        'crit': 'On critical hit',
        'kill': 'On kill',
        'death': 'On death',
        'stacks_depleted': 'When stacks reach 0',
        'removed': 'When removed',
        'encounter_start': 'At encounter start',
        'encounter_end': 'At encounter end',
        'floor_start': 'At floor start',
        'floor_end': 'At floor end',
        'dungeon_start': 'At dungeon start',
        'dungeon_end': 'At dungeon end',
        'enemy_spawn': 'When enemy spawns',
        'ability': 'When ability is used',
        'party_wipe': 'When party wipes',
        'ally_death': 'When an ally dies',
        'heal': 'When healing',
        'generator': 'When using a generator',
        'spender': 'When using a spender',
        'dodge': 'When dodging',
        'debuff_applied': 'When debuffed',
        'spell_cast': 'When casting a spell',
        'spell_hit': 'When a spell hits',
        'fatal_hit': 'On fatal hit',
        'before_death': 'Before death',
        'before_ability_cast': 'Before using an ability',
        'before_heal_delivered': 'Before healing',
        'after_heal_received': 'After being healed',
        'after_heal_delivered': 'After healing',
        'before_hit_delivered': 'Before hitting',
        'before_hit_received': 'Before being hit',
        'after_hit_delivered': 'After hitting',
        'after_hit_received': 'After being hit'
    };
    return triggerNames[trigger] || trigger.replace(/_/g, ' ');
}

function formatTarget(target, party) {
    if(!target || target === 'self') return '';

    const targetNames = {

        'self': 'self',
        'attacker': 'attacker',
        'target': 'target',
        'hit_target': 'target',
        'heal_target': 'target',
        'dead': 'dead',

        'front': 'front',
        'back': 'back',

        'all': 'all',
        'random': 'random',
        'lowest': 'lowest HP'
    };

    if(targetNames[target]) {
        const baseName = targetNames[target];

        if(baseName === 'attacker' || baseName === 'target') {
            return baseName;
        }

        const effectiveParty = party || 'enemy';
        if(effectiveParty === 'enemy') {
            if(baseName === 'all') return 'all enemies';
            if(baseName === 'front') return 'front enemy';
            if(baseName === 'back') return 'back enemy';
            if(baseName === 'random') return 'random enemy';
            if(baseName === 'lowest HP') return 'lowest HP enemy';
            if(baseName === 'dead') return 'dead enemy';
            return `${baseName} enemy`;
        }

        if(effectiveParty === 'hero' || effectiveParty === 'ally' || effectiveParty === 'player') {
            if(baseName === 'all') return 'all allies';
            if(baseName === 'front') return 'front ally';
            if(baseName === 'back') return 'back ally';
            if(baseName === 'random') return 'random ally';
            if(baseName === 'lowest HP') return 'lowest HP ally';
            if(baseName === 'dead') return 'dead ally';
            return `${baseName} ally`;
        }
        return baseName;
    }

    return target.replace(/_/g, ' ');
}

function joinEffectDescriptions(descriptions) {

    const filtered = descriptions.filter(d => d && d.trim());
    if (filtered.length === 0) return '';
    if (filtered.length === 1) return filtered[0];

    const lowercaseFirst = (str) => {
        if (!str) return str;
        const firstWord = str.split(/[\s,]/)[0];
        if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
            return str;  // Keep as-is for acronyms like "XP", "HP", etc.
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    };

    const actionWords = ['Apply', 'Deal', 'Heal', 'Remove', 'Grant'];

    const groups = [];
    let currentGroup = null;

    for (const desc of filtered) {
        const firstWord = desc.split(' ')[0];
        const isActionWord = actionWords.includes(firstWord);

        if (isActionWord && currentGroup && currentGroup.action === firstWord) {

            currentGroup.items.push(desc);
        } else {

            currentGroup = {
                action: isActionWord ? firstWord : null,
                items: [desc]
            };
            groups.push(currentGroup);
        }
    }

    const processedParts = [];
    for (const group of groups) {
        if (group.action && group.items.length > 1) {

            const first = group.items[0];
            const rest = group.items.slice(1).map(d => d.substring(group.action.length + 1));
            processedParts.push(first);
            processedParts.push(...rest);
        } else {

            processedParts.push(...group.items);
        }
    }

    if (processedParts.length === 1) {
        return processedParts[0];
    } else if (processedParts.length === 2) {
        return `${processedParts[0]} and ${lowercaseFirst(processedParts[1])}`;
    }

    const parts = processedParts.map((d, idx) =>
        idx > 0 ? lowercaseFirst(d) : d
    );
    const lastPart = parts.pop();
    return `${parts.join(', ')}, and ${lastPart}`;
}

function describeEffectFull(effect, manager, options = {}) {

    if (effect.describe === false) return '';
    
    const { includeTrigger = true, includeChance = true, displayMode = false } = options;

    let desc = describeEffect(effect, manager, displayMode);

    const target = effect.target || options.target;
    const party = effect.party || options.party;

    if (target === 'self' && (effect.type === 'damage' || effect.type === 'damage_flat')) {
        desc = `${desc} to self`;
    } else if(target && target !== 'self') {
        const targetName = formatTarget(target, party);

        if(targetName && !desc.toLowerCase().includes(targetName.toLowerCase())) {
            desc = `${desc} to ${targetName}`;
        }
    }

    const chance = effect.chance || options.chance;
    if(includeChance && chance && chance < 100 && !desc.includes('% chance')) {
        desc = `${desc} (${chance}% chance)`;
    }

    const typesWithBuiltInCondition = ['skip', 'miss', 'confuse', 'dodge'];
    if(effect.condition && !typesWithBuiltInCondition.includes(effect.type)) {
        const conditionDesc = describeCondition(effect.condition, manager);
        if(conditionDesc) {
            desc = `${desc} ${conditionDesc}`;
        }
    }

    if(effect.limit) {
        const times = effect.times || 1;
        const limitDesc = describeLimitSuffix(effect.limit, times);
        if(limitDesc) {
            desc = `${desc} ${limitDesc}`;
        }
    }

    if(effect.scope === 'party') {
        desc = `[Party] ${desc}`;
    }

    const trigger = effect.trigger || options.trigger;
    const descLower = desc.toLowerCase();
    const hasWhenClause = descLower.includes('when below') || descLower.includes('when above');
    if(includeTrigger && trigger && trigger !== 'passive' && trigger !== 'on_use' && !hasWhenClause) {
        const triggerSuffix = formatTriggerSuffix(trigger);
        if(triggerSuffix) {
            desc = `${desc} ${triggerSuffix}`;
        }
    }

    return desc;
}

function formatTriggerSuffix(trigger) {
    if(!trigger || trigger === 'passive' || trigger === 'on_use') return '';

    const suffixes = {
        'turn_start': 'at the start of the turn',
        'turn_end': 'at the end of the turn',
        'round_start': 'at the start of the round',
        'round_end': 'at the end of the round',

        'before_damage_delivered': 'before dealing damage',
        'after_damage_delivered': 'after dealing damage',
        'before_damage_received': 'before taking damage',
        'after_damage_received': 'after taking damage',
        'miss': 'on miss',
        'crit': 'on critical hit',
        'kill': 'on kill',
        'death': 'on death',
        'stacks_depleted': 'when stacks reach 0',
        'removed': 'when removed',
        'encounter_start': 'at the start of combat',
        'encounter_end': 'at the end of combat',
        'floor_start': 'at the start of a floor',
        'floor_end': 'at the end of the floor',
        'dungeon_start': 'at the start of a dungeon',
        'dungeon_end': 'at the end of the dungeon',
        'enemy_spawn': 'when an enemy spawns',
        'ability': 'when using an ability',
        'party_wipe': 'when the party wipes',
        'ally_death': 'when an ally dies',
        'heal': 'when healing',
        'generator': 'when using a generator',
        'spender': 'when using a spender',
        'dodge': 'when dodging',
        'debuff_applied': 'when debuffed',
        'spell_cast': 'when casting a spell',
        'spell_hit': 'when a spell hits',
        'fatal_hit': 'on fatal hit',
        'attack': 'on attack',
        'targeting': '',  // Internal trigger, don't show
        'before_debuff_received': 'before receiving a debuff',
        'before_heal_received': 'before receiving a heal',
        'before_spender_cast': 'before using a spender',
        'after_ability_cast': 'after using an ability',
        'before_death': 'before death',
        'before_ability_cast': 'before using an ability',
        'before_heal_delivered': 'before healing',
        'after_heal_received': 'after being healed',
        'after_heal_delivered': 'after healing',
        'before_hit_delivered': 'before hitting',
        'before_hit_received': 'before being hit',
        'after_hit_delivered': 'after hitting',
        'after_hit_received': 'after being hit'
    };

    const suffix = suffixes[trigger];
    return suffix !== undefined ? suffix : trigger.replace(/_/g, ' ');
}

function describeEffects(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return '';

    let mainEffects = effects.filter(e => e.describe !== false);
    
    if (mainEffects.length === 0) return '';

    const getTarget = (e) => e.target || options.target;
    const getParty = (e) => e.party || options.party;
    const getTrigger = (e) => e.trigger || options.trigger;

    const firstTarget = getTarget(mainEffects[0]);
    const firstParty = getParty(mainEffects[0]);
    const firstTrigger = getTrigger(mainEffects[0]);

    const allSameTarget = mainEffects.every(e =>
        getTarget(e) === firstTarget && getParty(e) === firstParty
    );
    const allSameTrigger = mainEffects.every(e => getTrigger(e) === firstTrigger);

    const lowercaseFirst = (str) => {
        if (!str) return str;

        const firstWord = str.split(/[\s,]/)[0];
        if (firstWord.length >= 2 && firstWord === firstWord.toUpperCase()) {
            return str;  // Keep as-is for acronyms like "XP", "HP", etc.
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    };

    let combined;

    if (allSameTarget && allSameTrigger) {

        const descriptions = mainEffects.map(e =>
            describeEffectFull(e, manager, {
                ...options,
                includeTrigger: false,

                target: null,
                party: null
            })
        );

        combined = joinEffectDescriptions(descriptions);

        if (firstTarget && firstTarget !== 'self') {
            const targetName = formatTarget(firstTarget, firstParty);
            if (targetName && !combined.toLowerCase().includes(targetName.toLowerCase())) {
                combined = `${combined} to ${targetName}`;
            }
        }

        if (firstTrigger && firstTrigger !== 'passive' && firstTrigger !== 'on_use') {
            const triggerSuffix = formatTriggerSuffix(firstTrigger);
            if (triggerSuffix && !combined.toLowerCase().includes('when below') && !combined.toLowerCase().includes('when above')) {
                combined = `${combined} ${triggerSuffix}`;
            }
        }
    } else {

        const triggerGroups = new Map();

        for (const e of mainEffects) {
            const trigger = getTrigger(e) || 'passive';
            if (!triggerGroups.has(trigger)) {
                triggerGroups.set(trigger, []);
            }
            triggerGroups.get(trigger).push(e);
        }

        const groupDescriptions = [];

        for (const [trigger, groupEffects] of triggerGroups) {

            const descriptions = groupEffects.map(e =>
                describeEffectFull(e, manager, {
                    ...options,
                    includeTrigger: false
                })
            );

            let groupCombined = joinEffectDescriptions(descriptions);

            if (trigger && trigger !== 'passive' && trigger !== 'on_use') {
                const triggerSuffix = formatTriggerSuffix(trigger);
                if (triggerSuffix && !groupCombined.toLowerCase().includes('when below') && !groupCombined.toLowerCase().includes('when above')) {
                    groupCombined = `${groupCombined} ${triggerSuffix}`;
                }
            }

            groupDescriptions.push(groupCombined);
        }

        if (groupDescriptions.length === 1) {
            combined = groupDescriptions[0];
        } else if (groupDescriptions.length === 2) {
            combined = `${groupDescriptions[0]} and ${lowercaseFirst(groupDescriptions[1])}`;
        } else {
            const first = groupDescriptions.shift();
            const last = groupDescriptions.pop();
            const middle = groupDescriptions.map(d => lowercaseFirst(d)).join(', ');
            combined = `${first}, ${middle}, and ${lowercaseFirst(last)}`;
        }
    }

    return combined;
}

function describeEffectsInline(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return '';
    const { separator = ', ' } = options;
    return effects
        .filter(e => e.describe !== false)
        .map(e => describeEffect(e, manager))
        .join(separator);
}

function getEffectDescriptionsList(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return [];
    const { includeChance = true } = options;

    return effects
        .filter(effect => effect.describe !== false)
        .map(effect => {

        if (effect.description) return effect.description;

        const trigger = formatTrigger(effect.trigger);
        let desc = describeEffect(effect, manager);

        if (includeChance && effect.chance !== undefined && effect.chance < 100) {
            desc = `${effect.chance}% chance: ${desc}`;
        }

        if (trigger && effect.trigger !== 'passive') {
            return `${trigger}: ${desc}`;
        }

        return desc;
    });
}

function buildEffectReplacements(effects, context, displayMode = false) {
    const replacements = {};
    effects.forEach((effect, i) => {
        if(effect.getAmount) {
            replacements[`effect.${i}.amount`] = effect.getAmount(context, displayMode);
        }
        if(effect.getStacks) {
            replacements[`effect.${i}.stacks`] = effect.getStacks(context, displayMode);
        }
    });
    return replacements;
}

function buildHitEffectReplacements(hits, stats, displayMode = false) {
    const replacements = {};
    hits.forEach((hit, i) => {
        hit.effects.forEach((effect, e) => {
            if(effect.getAmount) {
                replacements[`hit.${i}.effect.${e}.amount`] = effect.getAmount(stats, displayMode);
            }
            if(effect.getStacks) {
                replacements[`hit.${i}.effect.${e}.stacks`] = effect.getStacks(stats, displayMode);
            }
        });
    });
    return replacements;
}

class SimpleEffectInstance {
    constructor(amount, sourceName, stacks = 1) {
        this.amount = amount;
        this.stacks = stacks;
        this.base = { name: sourceName, consume: false };
        this.source = null;
        this.age = 0;
        this._isSimple = true; // Flag to identify simple instances
    }

    remove_stacks(count) { }
    remove() { }
}

function getEffectAmount(effect, instance) {

    if(instance._isSimple) {
        return instance.amount;
    }

    if(effect.getAmount) {
        return effect.getAmount(instance);
    }

    // Check both 'value' (from createEffect) and 'amount' (legacy)
    return effect.value ?? effect.amount ?? 0;
}

const UTILITY_EFFECT_XP = {
    skip: 3,
    miss: 2,
    confuse: 4,
    prevent_ability: 2,
    dodge: 2  // when granted by buff, not self-dodge
};

/**
 * Award combat XP to a hero's equipment and combat job.
 * @param {AdventuringHero} character - The hero to award XP to
 * @param {number} baseXP - Base XP before difficulty multiplier
 * @param {Adventuring} manager - The manager instance
 */
function awardCombatXP(character, baseXP, manager) {
    if (!character?.isHero || baseXP <= 0) return;
    
    const xp = Math.floor(baseXP * (manager.dungeon?.getDifficultyXPMultiplier() || 1));
    
    character.equipment?.forEachEquipped(item => item.addXP(xp));
    
    if (character.combatJob?.isMilestoneReward) {
        character.combatJob.addXP(Math.floor(xp / 2));
    }
}

/**
 * Award XP from an effect instance to its source character.
 * Wrapper around awardCombatXP for effect processor context.
 */
function awardSourceXP(instance, baseXP, ctx) {
    if (!instance?.source) return;
    awardCombatXP(instance.source, baseXP, ctx.manager);
}

class EffectProcessor {
    constructor() {

        this.handlers = new Map();
    }

    register(type, handler) {
        this.handlers.set(type, handler);
    }

    process(resolved, context) {
        const { effect, instance } = resolved;
        const handler = this.handlers.get(effect.type);

        if(handler) {
            return handler(effect, instance, context);
        }

        return context.extra;
    }

    processSimple(effect, amount, sourceName, context) {
        const handler = this.handlers.get(effect.type);

        if(handler) {

            const instance = new SimpleEffectInstance(amount, sourceName, effect.stacks || 1);
            return handler(effect, instance, context);
        }

        return context.extra;
    }

    /**
     * Process an effect: resolve targets, invoke handler, award XP.
     * Unified processing path for all effect types and targeting modes.
     * 
     * @param {Object} effect - The effect to process
     * @param {number} amount - Pre-computed amount
     * @param {number} stacks - Pre-computed stacks
     * @param {string} sourceName - Name of the effect source for logging
     * @param {Object} context - Processor context { character, caster, manager, extra }
     * @returns {boolean} True if effect was processed (had valid targets)
     */
    processEffect(effect, amount, stacks, sourceName, context) {
        const targetType = effect.target || 'self';
        const partyType = effect.party || effect.targetParty || 'ally';
        
        // Determine which party to resolve targets from
        const encounter = context.extra?.encounter;
        const targetParty = partyType === 'enemy' 
            ? encounter?.party 
            : context.manager.party;
        
        // Remove effects should work on dead targets (to clean up auras at encounter end)
        const isRemoveEffect = effect.type === 'remove' || effect.type === 'remove_stacks';
        
        // Build resolution context
        const resolveContext = {
            party: targetParty,
            self: context.character,
            attacker: context.extra?.attacker,
            target: context.extra?.target,
            exclude: null,
            allowDead: isRemoveEffect
        };
        
        // Resolve targets
        const targets = resolveTargets(targetType, resolveContext);
        
        if (targets.length === 0) {
            return false;
        }
        
        // Use the effect's source if it's an actual instance (e.g., aura instance),
        // otherwise create a simple instance for static effects
        const instance = (effect.source && !effect.source._isSimple && typeof effect.source.remove === 'function')
            ? effect.source
            : new SimpleEffectInstance(amount, sourceName, stacks);
        const handler = this.handlers.get(effect.type);
        
        if (!handler) {
            console.warn(`[applyEffect] No handler for effect type: ${effect.type}`);
            return false;
        }
        
        // Track original caster for effects applied to other targets
        const caster = context.caster || context.character;
        
        // Apply to each target
        for (const target of targets) {
            // Create per-target context with target as character
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
                    return; // Skip this effect
                }
            }

            const chance = effect.chance || 100;
            if (Math.random() * 100 > chance) {
                return; // Skip this effect
            }

            context.extra = this.process(resolved, context);
        });
        return context.extra;
    }
}

function createDefaultEffectProcessor() {
    const processor = new EffectProcessor();

    processor.register('skip', (effect, instance, ctx) => {
        ctx.extra.skip = true;
        return ctx.extra;
    });

    processor.register('reduce_amount', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const reduce = Math.min(ctx.extra.amount || 0, amount);
        ctx.extra.amount -= reduce;
        if(instance.base && instance.base.consume) {
            instance.remove_stacks(reduce);
        }
        return ctx.extra;
    });

    const damageOrHeal = (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const builtEffect = { amount };
        const isDamage = effect.type.includes('damage');
        const effectLabel = isDamage ? 'damage' : 'healing';
        
        // ctx.character is the target (set by applyEffect)
        // ctx.caster is the original source character
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;

        ctx.manager.log.add(`${target.name} receives ${amount} ${effectLabel} from ${instance.base.name}`, {
            category: isDamage ? 'combat_damage' : 'combat_heal',
            source: caster,
            target: target
        });
        target.applyEffect(effect, builtEffect, caster);

        if(amount > 0 && instance.source) {
            awardSourceXP(instance, Math.floor(amount / 2), ctx);
        }
        
        return ctx.extra;
    };
    processor.register('damage_flat', damageOrHeal);
    processor.register('heal_flat', damageOrHeal);

    processor.register('heal_percent', (effect, instance, ctx) => {
        const percentValue = (effect.amount !== undefined) ? effect.amount : ((instance.amount !== undefined) ? instance.amount : 0);
        if(percentValue <= 0) return ctx.extra;

        // ctx.character is the target (set by applyEffect)
        // ctx.caster is the original source character
        const target = ctx.character;
        const caster = ctx.caster || ctx.character;
        
        const healAmount = Math.ceil(target.maxHitpoints * (percentValue / 100));
        target.heal({ amount: healAmount }, caster);
        
        const casterName = caster?.name || 'Effect';
        ctx.manager.log.add(`${casterName}'s ${instance.base.name} heals ${target.name} for ${healAmount} (${percentValue}%)`, {
            category: 'combat_heal',
            source: caster,
            target: target
        });

        if(healAmount > 0 && instance.source) {
            awardSourceXP(instance, Math.floor(healAmount / 2), ctx);
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
        
        // ctx.character is the target (set by applyEffect)
        // ctx.caster is the original source character
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
            const casterName = caster?.name || 'Effect';
            ctx.manager.log.add(`${casterName}'s ${instance.base.name} applies ${getAuraName(ctx.manager, auraId)} to ${target.name}`, {
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
        
        // ctx.character is the target (set by applyEffect)
        // ctx.caster is the original source character
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
                const casterName = caster?.name || 'Effect';
                ctx.manager.log.add(`${casterName}'s ${instance.base.name} applies ${getAuraName(ctx.manager, auraId)} to ${target.name}`, {
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
        if(effect.count !== undefined) {
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

        if(amount > 0 && instance.source) {
            ctx.extra.damageContributions = ctx.extra.damageContributions || [];
            ctx.extra.damageContributions.push({ source: instance.source, amount });
        }
        
        return ctx.extra;
    });

    processor.register('damage_modifier_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;

        if(increase > 0 && instance.source) {
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

            if(instance.source) {
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

            if(instance.source && instance.source !== ctx.character) {
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

            if(instance.source) {
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

            if(instance.source) {
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

        if(instance.source) {
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
        if(instance.source) {
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

    processor.register('lifesteal', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const healAmount = Math.ceil((ctx.extra.damageDealt || 0) * (amount / 100));
        if(healAmount > 0) {
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
        if(ctx.extra.damageReceived && ctx.extra.attacker) {
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
        if(target && !target.dead && target.auras) {
            let removed = 0;
            for(const auraInstance of [...target.auras.auras.values()]) {
                if(auraInstance.base && auraInstance.base.isDebuff && removed < amount) {
                    auraInstance.stacks = 0;
                    removed++;
                }
            }
            if(removed > 0) {
                target.auras.cleanAuras();
                target.auras.renderQueue.auras = true;
                if(target.effectCache) {
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

        if(currentHP - incomingDamage <= 0 && currentHP > 0) {
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
        if(effect.consume !== false) {
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
        const totalAbsorb = amountPerStack * instance.stacks;
        const damage = ctx.extra.amount || 0;

        const absorbed = Math.min(damage, totalAbsorb);
        ctx.extra.amount = damage - absorbed;

        if(effect.consume !== false && absorbed > 0) {
            const stacksToRemove = Math.ceil(absorbed / amountPerStack);
            instance.remove_stacks(stacksToRemove);
        }

        if(absorbed > 0) {
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

        if(target && !target.dead && target.auras) {
            let removed = 0;

            for(const auraInstance of [...target.auras.auras.values()]) {
                if(auraInstance.base && !auraInstance.base.isDebuff && removed < count) {
                    auraInstance.stacks = 0;
                    removed++;
                }
            }
            if(removed > 0) {
                target.auras.cleanAuras();
                target.auras.renderQueue.auras = true;
                if(target.effectCache) {
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
        if(Math.random() * 100 < chance) {
            ctx.extra.doubleCast = true;
        }
        return ctx.extra;
    });

    processor.register('work', (effect, instance, ctx) => {
        if(ctx.extra.building && ctx.extra.building.page && ctx.extra.building.page.doWork) {
            ctx.extra.building.page.doWork(ctx.character);
        }
        return ctx.extra;
    });

    return processor;
}

const defaultEffectProcessor = createDefaultEffectProcessor();

function addMasteryXPWithBonus(manager, action, baseXP, options = {}) {
    const { updateTooltip = true, levelCap = 99 } = options;

    const xpBonus = manager.party.getMasteryXPBonus(action);
    let modifiedXP = Math.floor(baseXP * (1 + xpBonus));

    // Cap XP to prevent exceeding level cap
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

function buildDescription(config) {
    const {
        effects,
        hits,
        manager,
        template,
        flavorText,
        stats,
        displayMode = 'total',
        includeTrigger = true,
        buildReplacements
    } = config;

    let desc = '';

    if (template !== undefined && template !== null) {
        const source = hits !== undefined ? hits : effects;
        const replacements = buildReplacements
            ? buildReplacements(source, stats, displayMode)
            : buildEffectReplacements(effects, stats, true);
        desc = parseDescription(template, replacements);
    }

    else if (hits !== undefined && hits.length > 0) {
        const hitDescs = [];

        const isSelfTargetingEffect = (effectType, hitParty) => {

            if (hitParty === 'ally') return false;

            const selfTypes = ['heal_flat', 'heal_percent', 'buff', 'energy', 'shield'];
            return selfTypes.includes(effectType);
        };

        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (hit.effects === undefined || hit.effects.length === 0) continue;

            const selfEffects = [];
            const targetEffects = [];

            for (let j = 0; j < hit.effects.length; j++) {
                const effect = hit.effects[j];
                const effectObj = {
                    type: effect.type,
                    trigger: effect.trigger !== undefined ? effect.trigger : 'on_use',
                    amount: effect.getAmount !== undefined
                        ? effect.getAmount(stats, displayMode)
                        : (effect.amount !== undefined && effect.amount.base !== undefined
                            ? effect.amount.base
                            : (effect.amount !== undefined ? effect.amount : 0)),
                    stacks: effect.getStacks !== undefined
                        ? effect.getStacks(stats, displayMode)
                        : (effect.stacks !== undefined && effect.stacks.base !== undefined
                            ? effect.stacks.base
                            : (effect.stacks !== undefined ? effect.stacks : 0)),
                    id: effect.id,
                    condition: effect.condition,
                    chance: effect.chance,
                    random: effect.random,
                    count: effect.count,
                    threshold: effect.threshold
                };
                let effectDesc = describeEffectFull(effectObj, manager, { displayMode, includeTrigger: false });

                if (isSelfTargetingEffect(effect.type, hit.party)) {
                    selfEffects.push(effectDesc);
                } else {
                    targetEffects.push(effectDesc);
                }
            }

            const target = hit.target;
            const party = hit.party;
            const repeat = hit.repeat !== undefined ? hit.repeat : 1;
            const hitParts = [];

            if (targetEffects.length > 0) {
                let targetDesc = joinEffectDescriptions(targetEffects);
                if (target === 'self') {

                    if (targetDesc.toLowerCase().includes('deal')) {
                        targetDesc = `${targetDesc} to self`;
                    }
                } else if (target) {
                    const targetName = formatTarget(target, party);
                    if (targetName && !targetDesc.toLowerCase().includes(targetName.toLowerCase())) {
                        targetDesc = `${targetDesc} to ${targetName}`;
                    }
                }
                hitParts.push(targetDesc);
            }

            if (selfEffects.length > 0) {
                let selfDesc = joinEffectDescriptions(selfEffects);

                if (hitParts.length > 0) {
                    selfDesc = selfDesc.charAt(0).toLowerCase() + selfDesc.slice(1);
                }
                hitParts.push(selfDesc);
            }

            if (hitParts.length > 0) {
                hitDescs.push({ text: hitParts.join(' and '), repeat });
            }
        }

        if (hitDescs.length === 1) {
            const h = hitDescs[0];
            if (h.repeat > 1) {
                desc = `${h.text} (x${h.repeat})`;
            } else {
                desc = h.text;
            }
        } else if (hitDescs.length === 2) {

            if (hitDescs[0].text === hitDescs[1].text && hitDescs[0].repeat === 1 && hitDescs[1].repeat === 1) {
                desc = `${hitDescs[0].text} (hits twice)`;
            } else {
                const parts = hitDescs.map((h, i) => {
                    let text = i === 0 ? h.text : h.text.charAt(0).toLowerCase() + h.text.slice(1);
                    if (h.repeat > 1) text = `${text} (x${h.repeat})`;
                    return text;
                });
                desc = parts.join(', then ');
            }
        } else if (hitDescs.length > 2) {

            const allSame = hitDescs.every(h => h.text === hitDescs[0].text && h.repeat === hitDescs[0].repeat);
            if (allSame && hitDescs[0].repeat === 1) {
                desc = `${hitDescs[0].text} (hits ${hitDescs.length} times)`;
            } else {
                const parts = hitDescs.map((h, i) => {
                    let text = i === 0 ? h.text : h.text.charAt(0).toLowerCase() + h.text.slice(1);
                    if (h.repeat > 1) text = `${text} (x${h.repeat})`;
                    return text;
                });
                desc = parts.join(', then ');
            }
        }

        if (desc !== '') {
            desc = desc + '.';
        }
    }

    else if (effects !== undefined && effects.length > 0) {

        const effectObjs = effects.map(effect => ({
            type: effect.type,
            trigger: effect.trigger !== undefined ? effect.trigger : 'passive',
            amount: effect.getAmount !== undefined
                ? effect.getAmount(stats, displayMode)
                : (effect.amount !== undefined && effect.amount.base !== undefined
                    ? effect.amount.base
                    : (effect.amount !== undefined ? effect.amount : 0)),
            stacks: effect.getStacks !== undefined
                ? effect.getStacks(stats, displayMode)
                : (effect.stacks !== undefined && effect.stacks.base !== undefined
                    ? effect.stacks.base
                    : (effect.stacks !== undefined ? effect.stacks : 0)),
            id: effect.id,
            stat: effect.stat,
            target: effect.target,
            party: effect.party,
            condition: effect.condition,
            chance: effect.chance,
            random: effect.random,
            count: effect.count,
            threshold: effect.threshold,
            describe: effect.describe
        }));

        desc = describeEffects(effectObjs, manager, { displayMode, includeTrigger });
        if (desc !== '') {
            desc = desc + '.';
        }
    }

    if (flavorText !== undefined && flavorText !== null && flavorText !== '') {
        desc = desc !== '' ? `${desc}<br><br><em>${flavorText}</em>` : `<em>${flavorText}</em>`;
    }

    return desc !== '' ? desc : '';
}

class AdventuringMasteryRenderQueue {
    constructor() {
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }

    queueAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
    }

    updateAll() {
        this.queueAll();
    }
}

class AdventuringBadgeRenderQueue extends AdventuringMasteryRenderQueue {
    constructor() {
        super();
        this.newBadge = false;
    }

    queueAll() {
        super.queueAll();
        this.newBadge = true;
    }
}

class AdventuringEquipmentRenderQueue extends AdventuringBadgeRenderQueue {
    constructor() {
        super();

        this.name = undefined;
        this.clickable = undefined;
        this.mastery = undefined;

        this.upgrade = false;
        this.selected = false;
        this.highlight = false;
        this.equipped = false;
    }

    queueAll() {
        this.tooltip = true;
        this.icon = true;
        this.newBadge = true;
        this.upgrade = true;
        this.selected = true;
        this.highlight = true;
        this.equipped = true;
    }
}

function getFromRegistry(registry, id, context = 'object', warn = false) {
    if (!registry || !id) return undefined;

    const obj = registry.getObjectByID(id);
    if (!obj && warn) {
        console.warn(`[Adventuring] Unknown ${context}: ${id}`);
    }
    return obj;
}

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

export {
    AdventuringWeightedTable,
    randomElement,
    randomInt,
    rollChance,
    clamp,
    toPercent,
    resolveTargets,
    sortByAgility,
    getAuraName,
    createEffect,
    filterEffects,
    EffectCache,
    awardCombatXP,

    RequirementsChecker,
    formatRequirement,
    formatRequirements,
    parseDescription,
    describeEffect,
    describeEffectFull,
    describeEffects,
    describeEffectsInline,
    getEffectDescriptionsList,
    formatTrigger,
    formatTriggerSuffix,
    formatTarget,
    buildEffectReplacements,
    buildHitEffectReplacements,
    buildDescription,

    SimpleEffectInstance,
    getEffectAmount,
    EffectProcessor,
    defaultEffectProcessor,
    addMasteryXPWithBonus,

    evaluateCondition,
    describeCondition,
    buildEffectContext,
    getPooledContext,
    releaseContext,

    AdventuringMasteryRenderQueue,
    AdventuringBadgeRenderQueue,
    AdventuringEquipmentRenderQueue,

    UNKNOWN_MEDIA,
    getLockedMedia,

    StatCalculator,

    PassiveEffectProcessor,

    EffectLimitTracker,

    getFromRegistry,
    requireFromRegistry
}

