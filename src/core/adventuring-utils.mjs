const { loadModule } = mod.getContext(import.meta);

/**
 * Adventuring Utility Functions
 * 
 * Shared helper functions to reduce duplicate code across the mod.
 */

/**
 * Get a random element from an array
 * @param {Array} array - Array to select from
 * @returns {*} Random element or undefined if array is empty
 */
function randomElement(array) {
    if(!array || array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Roll a percentage chance
 * @param {number} chance - Percentage chance (0-100)
 * @returns {boolean} True if roll succeeds
 */
function rollChance(chance) {
    return Math.random() * 100 < chance;
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculate percentage
 * @param {number} value - Current value
 * @param {number} max - Maximum value
 * @returns {number} Percentage (0-100)
 */
function toPercent(value, max) {
    if(max <= 0) return 0;
    return clamp((value / max) * 100, 0, 100);
}

/**
 * Resolve targets from a party based on target type
 * @param {string} targetType - Target selection type (front, back, random, lowest, aoe, dead)
 * @param {object} party - Party object with front, center, back, all getters
 * @param {object} [exclude] - Character to exclude from selection
 * @returns {Array} Array of target characters
 */
function resolveTargets(targetType, party, exclude = null) {
    const alive = party.all.filter(t => !t.dead && t !== exclude);
    
    switch(targetType) {
        case "none":
            return [];
            
        case "front": {
            // Priority: front > center > back
            if(!party.front.dead && party.front !== exclude) return [party.front];
            if(!party.center.dead && party.center !== exclude) return [party.center];
            if(!party.back.dead && party.back !== exclude) return [party.back];
            return [];
        }
        
        case "back": {
            // Priority: back > center > front
            if(!party.back.dead && party.back !== exclude) return [party.back];
            if(!party.center.dead && party.center !== exclude) return [party.center];
            if(!party.front.dead && party.front !== exclude) return [party.front];
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
            return alive;
            
        case "dead":
            return party.all.filter(t => t.dead && t !== exclude);
            
        default:
            return [];
    }
}

/**
 * Sort characters by agility stat (highest first)
 * @param {Array} characters - Characters to sort
 * @param {object} statsRegistry - Stats registry to look up agility
 * @returns {Array} Sorted copy of characters
 */
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
        return drop;
    }
}

/**
 * Standard Effect object structure
 * All effect sources (auras, consumables, equipment, etc.) should return effects in this format.
 * 
 * @typedef {Object} StandardEffect
 * @property {string} trigger - When the effect activates: 'passive', 'turn_start', 'before_damage_delivered', etc.
 * @property {string} type - What the effect does: 'increase_stat_flat', 'increase_stat_percent', 'damage', 'heal', 'buff', 'debuff', etc.
 * @property {string} [stat] - For stat effects, the stat ID (e.g., 'adventuring:strength')
 * @property {number} [value] - The effect value/amount
 * @property {object} source - Reference to the source object (consumable, aura instance, equipment, etc.)
 * @property {string} sourceName - Display name of the source
 * @property {string} [target] - Target of the effect: 'self', 'attacker', 'party', etc.
 */

/**
 * Create a standardized effect object
 * @param {object} effectData - Raw effect data
 * @param {object} source - The source object (consumable, aura, equipment, etc.)
 * @param {string} sourceName - Display name for the source
 * @returns {StandardEffect} Standardized effect object
 */
function createEffect(effectData, source, sourceName) {
    return {
        trigger: effectData.trigger || 'passive',
        type: effectData.type,
        stat: effectData.stat || effectData.id,  // stat effects use 'stat', auras use 'id'
        value: effectData.value ?? effectData.amount ?? 0,
        target: effectData.target,
        condition: effectData.condition || null,  // Condition object for conditional triggers
        chance: effectData.chance,  // Shorthand for simple chance conditions
        stacks: effectData.stacks,  // For buff/debuff effects
        id: effectData.id || effectData.aura || effectData.buff || effectData.debuff,  // Aura ID for buff/debuff
        source: source,
        sourceName: sourceName
    };
}

/**
 * Filter effects by trigger type
 * @param {StandardEffect[]} effects - Array of effects
 * @param {string} trigger - Trigger to filter by
 * @returns {StandardEffect[]} Filtered effects
 */
function filterEffectsByTrigger(effects, trigger) {
    return effects.filter(e => e.trigger === trigger);
}

/**
 * Filter effects by type
 * @param {StandardEffect[]} effects - Array of effects
 * @param {string} type - Type to filter by
 * @returns {StandardEffect[]} Filtered effects
 */
function filterEffectsByType(effects, type) {
    return effects.filter(e => e.type === type);
}

/**
 * Get stat effects for a specific stat
 * @param {StandardEffect[]} effects - Array of effects  
 * @param {string} statId - Stat ID to filter by
 * @returns {StandardEffect[]} Effects targeting this stat
 */
function getStatEffects(effects, statId) {
    return effects.filter(e => 
        (e.type === 'increase_stat_flat' || e.type === 'increase_stat_percent') && 
        e.stat === statId
    );
}

/**
 * EffectCache - Caches aggregated effects from all sources for performance.
 * 
 * Sources register themselves and the cache aggregates their effects.
 * Cache is invalidated when any source changes (via dirty flags).
 * 
 * Usage:
 *   cache.registerSource('equipment', () => equipment.getEffects());
 *   cache.invalidate('equipment');  // Call when equipment changes
 *   const effects = cache.getEffects('passive');  // Returns cached or rebuilds
 */
class EffectCache {
    constructor() {
        /** @type {Map<string, () => StandardEffect[]>} */
        this.sources = new Map();
        
        /** @type {Map<string, boolean>} */
        this.dirtyFlags = new Map();
        
        /** @type {Map<string, StandardEffect[]>} */
        this.cachedByTrigger = new Map();
        
        /** @type {StandardEffect[]|null} */
        this.allEffectsCache = null;
        
        /** @type {Map<string, number>} Cached computed bonuses */
        this.bonusCache = new Map();
        
        /** @type {boolean} */
        this.globalDirty = true;
    }
    
    /**
     * Register an effect source
     * @param {string} sourceId - Unique identifier for this source
     * @param {() => StandardEffect[]} getEffectsFn - Function that returns effects from this source
     */
    registerSource(sourceId, getEffectsFn) {
        this.sources.set(sourceId, getEffectsFn);
        this.dirtyFlags.set(sourceId, true);
        this.globalDirty = true;
    }
    
    /**
     * Unregister an effect source
     * @param {string} sourceId - Source to remove
     */
    unregisterSource(sourceId) {
        this.sources.delete(sourceId);
        this.dirtyFlags.delete(sourceId);
        this.globalDirty = true;
    }
    
    /**
     * Mark a source as dirty (needs refresh)
     * @param {string} sourceId - Source that changed
     */
    invalidate(sourceId) {
        if(this.dirtyFlags.has(sourceId)) {
            this.dirtyFlags.set(sourceId, true);
            this.globalDirty = true;
            this.allEffectsCache = null;
            this.cachedByTrigger.clear();
            this.bonusCache.clear();
        }
    }
    
    /**
     * Mark all sources as dirty
     */
    invalidateAll() {
        this.dirtyFlags.forEach((_, key) => this.dirtyFlags.set(key, true));
        this.globalDirty = true;
        this.allEffectsCache = null;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
    }
    
    /**
     * Check if cache needs rebuild
     */
    isDirty() {
        return this.globalDirty;
    }
    
    /**
     * Rebuild the cache from all sources
     */
    rebuild() {
        if(!this.globalDirty) return;
        
        const allEffects = [];
        
        this.sources.forEach((getEffectsFn, sourceId) => {
            try {
                const effects = getEffectsFn();
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
    
    /**
     * Get all effects, optionally filtered by trigger
     * @param {string} [trigger] - Optional trigger filter
     * @returns {StandardEffect[]}
     */
    getEffects(trigger = null) {
        this.rebuild();
        
        if(trigger === null) {
            return this.allEffectsCache || [];
        }
        
        // Check trigger cache
        if(this.cachedByTrigger.has(trigger)) {
            return this.cachedByTrigger.get(trigger);
        }
        
        // Build and cache filtered results
        const filtered = (this.allEffectsCache || []).filter(e => e.trigger === trigger);
        this.cachedByTrigger.set(trigger, filtered);
        return filtered;
    }
    
    /**
     * Get computed bonus for a specific effect type.
     * Sums all passive effects of the given type.
     * @param {string} effectType - Effect type to sum (e.g., 'increase_xp_percent')
     * @returns {number} Total bonus value
     */
    getBonus(effectType) {
        this.rebuild();
        
        const cacheKey = `bonus:${effectType}`;
        if(this.bonusCache.has(cacheKey)) {
            return this.bonusCache.get(cacheKey);
        }
        
        const passiveEffects = this.getEffects('passive');
        const total = passiveEffects
            .filter(e => e.type === effectType)
            .reduce((sum, e) => sum + (e.value || 0), 0);
        
        this.bonusCache.set(cacheKey, total);
        return total;
    }
    
    /**
     * Get computed stat bonus (flat + percent).
     * @param {string} statId - Stat ID to calculate
     * @returns {{ flat: number, percent: number }} Bonuses
     */
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
                if(e.type === 'increase_stat_flat') {
                    flat += e.value || 0;
                } else if(e.type === 'increase_stat_percent') {
                    percent += e.value || 0;
                }
            }
        });
        
        const result = { flat, percent };
        this.bonusCache.set(cacheKey, result);
        return result;
    }
    
    /**
     * Clear all caches
     */
    clear() {
        this.allEffectsCache = null;
        this.cachedByTrigger.clear();
        this.bonusCache.clear();
        this.globalDirty = true;
    }
}

// ============================================================================
// REQUIREMENTS CHECKER
// ============================================================================

/**
 * Centralized requirement checking utility.
 * Consolidates all requirement.type checks into a single location.
 */
class RequirementsChecker {
    /**
     * @param {object} manager - The adventuring manager
     * @param {Array} requirements - Array of requirement objects
     */
    constructor(manager, requirements = []) {
        this.manager = manager;
        this.requirements = requirements;
    }
    
    /**
     * Check if all requirements are met
     * @param {object} [context] - Optional context (character, etc.)
     * @returns {boolean} True if all requirements are met
     */
    check(context = {}) {
        if(!this.requirements || this.requirements.length === 0) return true;
        return this.requirements.every(req => this.checkSingle(req, context));
    }
    
    /**
     * Check a single requirement
     * @param {object} req - Requirement object
     * @param {object} context - Context with optional character
     * @returns {boolean} True if requirement is met
     */
    checkSingle(req, context = {}) {
        // Skip malformed requirements
        if(!req || !req.type) {
            console.warn(`Malformed requirement:`, req);
            return true;
        }
        
        const { character } = context;
        
        switch(req.type) {
            case 'skill_level':
                return this.manager.level >= req.level;
                
            case 'job_level':
                return this._checkJobLevel(req.job, req.level);
                
            case 'current_job_level':
                return this._checkCurrentJobLevel(req.job, req.level, character);
                
            case 'slayer_tasks_completed':
                return (this.manager.slayers?.totalTasksCompleted || 0) >= req.count;
                
            case 'current_job':
                return this._hasCurrentJob(req.job, character);
                
            case 'dead':
                return character?.dead ?? false;
                
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
                // Check if the required achievement is completed
                const achievement = this.manager.achievements?.getObjectByID(req.id);
                return achievement ? achievement.isComplete : false;
            }

            default:
                console.warn(`Unknown requirement type: ${req.type}`);
                return true;
        }
    }
    
    /**
     * Check if a job has reached the required mastery level
     */
    _checkJobLevel(jobId, level) {
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return false;
        return this.manager.getMasteryLevel(job) >= level;
    }
    
    /**
     * Check if character's current job meets level requirement
     */
    _checkCurrentJobLevel(jobId, level, character) {
        if(!character) return false;
        
        // Check if character has this job equipped (combat or passive)
        const hasCombatJob = character.combatJob?.id === jobId;
        const hasPassiveJob = character.passiveJob?.id === jobId;
        
        if(!hasCombatJob && !hasPassiveJob) return false;
        
        // Check mastery level of that job
        const job = this.manager.jobs.getObjectByID(jobId);
        if(!job) return false;
        return this.manager.getMasteryLevel(job) >= level;
    }
    
    /**
     * Check if character has a specific job equipped
     */
    _hasCurrentJob(jobId, character) {
        if(!character) return false;
        return (character.combatJob?.id === jobId) || (character.passiveJob?.id === jobId);
    }
    
    /**
     * Check comparison requirements (e.g., HP thresholds, material counts)
     * Supports both formats:
     *   - New: { property, operator: '<'|'>'|'==', value }
     *   - Legacy: { operand, operator: 'lt'|'gt'|'eq', amount, material? }
     */
    _checkComparison(req, character) {
        let value;
        
        // Handle legacy 'operand' format
        const operand = req.property || req.operand;
        const target = req.value ?? req.amount;
        
        switch(operand) {
            case 'hitpoints_percent':
            case 'hitpoint_pct':
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
                value = this.manager.stash.materialCounts.get(material) ?? 0;
                break;
            }
            default:
                return false;
        }
        
        // Handle both operator formats
        const op = req.operator;
        switch(op) {
            case '<':
            case 'lt':
                return value < target;
            case '<=':
                return value <= target;
            case '>':
            case 'gt':
                return value > target;
            case '>=':
                return value >= target;
            case '==':
            case 'eq':
                return value === target;
            default:
                return false;
        }
    }
    
    /**
     * Check if any requirement references a specific job (for unlockedBy checks)
     * @param {string} jobId - Job ID to check for
     * @returns {boolean} True if any requirement references this job
     */
    referencesJob(jobId) {
        return this.requirements.some(req => 
            (req.type === 'job_level' || req.type === 'current_job_level') && 
            req.job === jobId
        );
    }
}

/**
 * Format a single requirement into a human-readable description with met status.
 * 
 * @param {object} req - Requirement object
 * @param {object} manager - AdventuringManager for resolving names
 * @param {object} [context] - Optional context (character, etc.)
 * @returns {{ text: string, met: boolean }} Formatted requirement
 */
function formatRequirement(req, manager, context = {}) {
    const checker = new RequirementsChecker(manager, [req]);
    const met = checker.check(context);
    let text = '';
    
    switch(req.type) {
        case 'skill_level':
            text = `Adventuring Level ${req.level}`;
            break;
            
        case 'job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job?.name || req.job;
            text = `${jobName} Level ${req.level}`;
            break;
        }
        
        case 'current_job': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job?.name || req.job;
            text = `Requires ${jobName} equipped`;
            break;
        }
        
        case 'current_job_level': {
            const job = manager.jobs.getObjectByID(req.job);
            const jobName = job?.name || req.job;
            text = `${jobName} Level ${req.level} (equipped)`;
            break;
        }
        
        case 'area_mastery': {
            const area = manager.areas.getObjectByID(req.area);
            const areaName = area?.name || req.area;
            text = `${areaName} Mastery ${req.level}`;
            break;
        }
        
        case 'item_upgrade': {
            const item = manager.baseItems.getObjectByID(req.item);
            const itemName = item?.name || req.item;
            text = `${itemName} +${req.level}`;
            break;
        }
        
        case 'slayer_tasks_completed':
            text = `${req.count} Slayer Tasks Completed`;
            break;
        
        case 'comparison': {
            const operand = req.property || req.operand;
            const target = req.value ?? req.amount;
            const opSymbol = { '<': '<', 'lt': '<', '>': '>', 'gt': '>', '==': '=', 'eq': '=' }[req.operator] || req.operator;
            text = `${operand.replace(/_/g, ' ')} ${opSymbol} ${target}`;
            break;
        }
        
        default:
            text = `${req.type}: ${req.level || req.value || '?'}`;
    }
    
    return { text, met };
}

/**
 * Format an array of requirements into human-readable descriptions with met status.
 * 
 * @param {Array} requirements - Array of requirement objects
 * @param {object} manager - AdventuringManager for resolving names
 * @param {object} [context] - Optional context (character, etc.)
 * @returns {Array<{ text: string, met: boolean }>} Formatted requirements
 */
function formatRequirements(requirements, manager, context = {}) {
    if(!requirements || requirements.length === 0) return [];
    return requirements.map(req => formatRequirement(req, manager, context));
}

// ============================================================================
// CONDITION SYSTEM
// ============================================================================

/**
 * Evaluate a condition object against a character context.
 * Conditions can be combined with effects to create conditional triggers.
 * 
 * Supported condition types:
 *   - hp_below: { type: "hp_below", threshold: 50 } - HP below 50%
 *   - hp_above: { type: "hp_above", threshold: 80 } - HP above 80%
 *   - has_buff: { type: "has_buff", id: "adventuring:might" } - Has specific buff
 *   - has_debuff: { type: "has_debuff", id: "adventuring:poison" } - Has specific debuff
 *   - buff_stacks: { type: "buff_stacks", id: "...", min: 3 } - Has at least N stacks of buff
 *   - missing_hp: { type: "missing_hp", min: 20 } - Missing at least N HP
 *   - enemy_hp_below: { type: "enemy_hp_below", threshold: 25 } - Target HP below %
 *   - chance: { type: "chance", value: 25 } - 25% chance to trigger
 * 
 * @param {object} condition - Condition object with type and parameters
 * @param {object} context - Context object containing character, target, manager, etc.
 * @returns {boolean} Whether the condition is met
 */
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
        
        default:
            console.warn(`Unknown condition type: ${condition.type}`);
            return true;
    }
}

/**
 * Generate a human-readable description for a condition.
 * 
 * @param {object} condition - Condition object
 * @param {object} manager - AdventuringManager for resolving names
 * @returns {string} Human-readable condition description
 */
function describeCondition(condition, manager) {
    if(!condition) return '';
    
    const auraName = (auraId) => {
        const aura = manager?.auras?.getObjectByID(auraId) || 
                     manager?.buffs?.getObjectByID(auraId) || 
                     manager?.debuffs?.getObjectByID(auraId);
        return aura?.name || auraId || 'Unknown';
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
            return `${condition.value}% chance`;
        case 'is_injured':
            return `when injured`;
        case 'is_full_hp':
            return `at full HP`;
        case 'any_ally_injured':
            return `if any ally is injured`;
        case 'all_allies_alive':
            return `if all allies are alive`;
        default:
            return condition.type;
    }
}

// ============================================================================
// DESCRIPTION PARSER
// ============================================================================

/**
 * Parse a template description string, replacing placeholders with values.
 * Supports formats:
 *   {effect.0.amount}, {effect.0.stacks}
 *   {hit.0.effect.0.amount}, {hit.0.effect.0.stacks}
 * 
 * @param {string} template - Description template with placeholders
 * @param {object} replacements - Map of placeholder to value
 * @returns {string} Parsed description
 */
function parseDescription(template, replacements) {
    if(!template) return '';
    
    let result = template;
    for(const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

/**
 * Generate a human-readable description for an effect.
 * Centralizes effect description logic for use across tooltips, logs, etc.
 * 
 * @param {object} effect - Effect object with type, value, stat, etc.
 * @param {object} manager - AdventuringManager for resolving stat names
 * @returns {string} Human-readable description
 */
function describeEffect(effect, manager) {
    if(!effect) return '';
    
    // If effect has explicit description, use it
    if(effect.description) return effect.description;
    
    const sign = (val) => val >= 0 ? '+' : '';
    const statName = (statId) => {
        const stat = manager?.stats?.getObjectByID(statId);
        return stat?.name || statId || 'Unknown';
    };
    const auraName = (auraId) => {
        const aura = manager?.auras?.getObjectByID(auraId);
        return aura?.name || auraId || 'Unknown';
    };
    
    switch(effect.type) {
        // Stat modifiers
        case 'increase_stat_flat':
            if (effect.perStack) return `+${statName(effect.stat || effect.id)} per stack`;
            return `${sign(effect.value)}${effect.value} ${statName(effect.stat || effect.id)}`;
        case 'increase_stat_percent':
            if (effect.perStack) return `+% ${statName(effect.stat || effect.id)} per stack`;
            const statPctVal = effect.value ?? effect.amount;
            return `${sign(statPctVal)}${statPctVal}% ${statName(effect.stat || effect.id)}`;
        
        // Damage/Healing
        case 'damage':
            if (effect.perStack) return 'Deal damage per stack';
            return `Deal ${effect.value || effect.amount || '?'} damage`;
        case 'heal':
            if (effect.perStack) return 'Heal per stack';
            return `Heal ${effect.value || effect.amount || effect.count || '?'} HP`;
        case 'heal_percent':
            const healPct = typeof effect.value === 'number' 
                ? effect.value 
                : (typeof effect.amount === 'number' && effect.amount <= 1 
                    ? Math.round(effect.amount * 100) 
                    : (effect.amount || 0));
            return `Restore ${healPct}% HP`;
        case 'lifesteal':
            if (effect.perStack) return 'Lifesteal % per stack';
            return `Heal for ${effect.value || effect.amount || '?'}% of damage dealt`;
        
        // Damage modifiers
        case 'damage_buff':
        case 'increase_damage':
            if (effect.perStack) return '+Damage per stack';
            return `${sign(effect.value || effect.amount)}${effect.value || effect.amount} Damage`;
        case 'increase_damage_percent':
            if (effect.perStack) return '+% Damage per stack';
            const dmgPctVal = effect.value ?? effect.amount;
            return `${sign(dmgPctVal)}${dmgPctVal}% Damage`;
        case 'reduce_stat_percent':
            if (effect.perStack) return `-% ${statName(effect.id)} per stack`;
            return `-${effect.value || effect.amount}% ${statName(effect.id)}`;
        case 'defense_buff':
            return `${sign(effect.value || effect.amount)}${effect.value || effect.amount} Defense`;
        case 'speed_buff':
            return `${sign(effect.value || effect.amount)}${effect.value || effect.amount} Speed`;
        
        // Buffs/Debuffs - unified types with target field
        case 'buff':
            return `Apply ${effect.stacks || 1} ${auraName(effect.id || effect.aura || effect.buff)}`;
        case 'debuff':
            return `Apply ${effect.stacks || 1} ${auraName(effect.id || effect.aura || effect.debuff)}`;
        case 'cleanse':
            return effect.id ? `Remove ${auraName(effect.id)}` : 'Cleanse debuffs';
        
        // Energy
        case 'energy':
            return `${sign(effect.value || effect.amount)}${effect.value || effect.amount} Energy`;
        case 'energy_gain_bonus':
            return `+${effect.value}% energy from generators`;
        
        // Multipliers
        case 'xp_multiplier':
            return `${sign((effect.value - 1) * 100)}${Math.round((effect.value - 1) * 100)}% XP`;
        case 'loot_multiplier':
            return `${sign((effect.value - 1) * 100)}${Math.round((effect.value - 1) * 100)}% Loot`;
        case 'enemy_stat_multiplier':
            return `Enemy Stats: ${sign((effect.value - 1) * 100)}${Math.round((effect.value - 1) * 100)}%`;
        
        // Revival
        case 'revive':
        case 'revive_all':
            return `Revive with ${effect.hpPercent ? Math.round(effect.hpPercent * 100) + '%' : 'full'} HP`;
        
        // Tile-specific effects
        case 'teleport':
            return 'Teleport to a random tile';
        case 'loot':
            return 'Contains random loot';
        case 'xp':
            return `Grant ${effect.amount || effect.value} Job XP`;
        
        // Percentage-based damage (tiles use amount as decimal 0-1)
        case 'damage_percent':
            const dmgPct = typeof effect.amount === 'number' && effect.amount <= 1 
                ? Math.round(effect.amount * 100) 
                : (effect.amount || effect.value);
            return `Deal ${dmgPct}% HP damage`;
        
        // Conditional/bonus damage
        case 'damage_bonus':
            return `+${effect.value}% damage`;
        case 'damage_reduction':
            return `${effect.value}% damage reduction`;
        
        // Immunity
        case 'immunity':
        case 'debuff_immunity':
            return `Immune to ${auraName(effect.debuff || effect.id)}`;
        
        // Crit
        case 'crit_chance':
        case 'crit_chance_bonus':
            return `+${effect.value}% critical chance`;
        case 'crit_damage':
        case 'crit_damage_bonus':
            return `+${effect.value}% critical damage`;
        
        // Cost reduction
        case 'cost_reduction':
        case 'ability_cost_reduction':
            return `-${effect.value}% ability cost`;
        
        // Dodge
        case 'dodge_chance':
            return `${effect.value}% dodge chance`;
        
        // Healing modifiers
        case 'healing_bonus':
            return `+${effect.value}% healing done`;
        case 'healing_received':
            return `+${effect.value}% healing received`;
        
        // Damage reflection
        case 'reflect_damage':
            if (effect.perStack) return `Reflect % damage per stack`;
            return `Reflect ${effect.value ?? effect.amount}% damage taken`;
        
        // Spell echo
        case 'spell_echo':
            return `${effect.chance || effect.value}% chance to cast spells twice`;
        
        // Execute
        case 'execute':
            return `Execute enemies below ${effect.threshold}% HP`;
        
        // All stat bonus
        case 'all_stat_bonus':
            return `+${effect.value}% all stats`;
        
        // Party healing
        case 'heal_party_percent':
            return `Heal party for ${effect.value}% max HP`;
        
        // Random buffs/debuffs
        case 'random_buffs':
            return `Apply ${effect.count} random buffs (${effect.stacks} stacks)`;
        case 'random_debuffs':
            return `Apply ${effect.count} random debuffs (${effect.stacks} stacks)`;
        

        // Singular versions
        case 'random_buff':
            return `Apply random buff (${effect.stacks || 1} stacks)`;
        case 'random_debuff':
            return `Apply random debuff (${effect.stacks || 1} stacks)`;

        // Dispel effects
        case 'dispel':
        case 'dispel_buff':
            return `Remove ${effect.count || 1} buff(s) from target`;
        case 'dispel_debuff':
            return `Remove ${effect.count || 1} debuff(s)`;

        // Enemy stat debuff
        case 'enemy_stat_debuff':
            return `Reduce enemy ${statName(effect.stat || effect.id)} by ${effect.value || effect.amount}%`;

        // Cleanse variants
        case 'cleanse_debuff':
        case 'cleanse_random_debuff':
            return `Cleanse ${effect.count || 1} debuff(s)`;
        case 'cleanse_all_allies':
            return `Cleanse all allies`;

        // Buff all allies
        case 'buff_all_allies':
            return `Buff all allies with ${auraName(effect.id)}`;

        // Apply variants
        case 'apply_buff':
            return `Apply ${effect.stacks || 1} ${auraName(effect.id)}`;
        case 'apply_debuff':
            return `Apply ${effect.stacks || 1} ${auraName(effect.id)} to target`;
        case 'apply_debuff_all':
            return `Apply ${effect.stacks || 1} ${auraName(effect.id)} to all enemies`;

        // Damage variants
        case 'damage_all':
        case 'damage_all_enemies':
            return `Deal ${effect.value || effect.amount || '?'} damage to all enemies`;

        // Summon effects
        case 'summon':
            return `Summon a companion`;
        case 'summon_power_bonus':
            return `+${effect.value}% summon power`;
        case 'summon_attack_speed':
            return `+${effect.value}% summon attack speed`;

        // Armor pierce
        case 'armor_pierce':
        case 'armour_penetration':
        case 'ignore_defence':
            return `Ignore ${effect.value || effect.amount}% defense`;

        // Ward
        case 'ward':
            return `Block next ${effect.stacks || 1} attacks`;

        // Charm
        case 'charm':
            return `Charm target for ${effect.duration || 1} turns`;

        // Double cast
        case 'double_cast':
            return `${effect.chance || effect.value}% chance to cast twice`;

        // Mastery unlock effects
        case 'unlock_auto_run':
            return 'Unlock Auto-Run';
        case 'unlock_difficulty':
            const diffId = effect.difficultyID?.split(':').pop() || 'Unknown';
            return `Unlock ${diffId.charAt(0).toUpperCase() + diffId.slice(1)} Mode`;
        case 'unlock_mastery_aura':
            return 'Unlock Mastery Aura';
        case 'unlock_multi_job_assignment':
            return 'Unlock Multi-Job Assignment';
        case 'unlock_mastered_variant':
            return 'Unlock Mastered Variant';

        // Mastery stat bonuses
        case 'job_stats_percent':
            return `+${effect.value}% Job Stats`;
        case 'drop_rate_percent':
            return `+${effect.value}% Drop Rate`;
        case 'drop_quantity_percent':
            return `+${effect.value}% Drop Quantity`;
        case 'explore_speed_percent':
            return `+${effect.value}% Explore Speed`;
        case 'trap_spawn_rate_percent':
            return `${effect.value > 0 ? '+' : ''}${effect.value}% Trap Spawn Rate`;
        case 'fountain_spawn_rate_percent':
            return `+${effect.value}% Fountain Spawn Rate`;
        case 'treasure_spawn_rate_percent':
            return `+${effect.value}% Treasure Spawn Rate`;
        case 'shrine_spawn_rate_percent':
            return `+${effect.value}% Shrine Spawn Rate`;
        case 'ability_learn_chance_percent':
            return `+${effect.value}% Ability Learn Chance`;
        case 'equipment_xp_percent':
            return `+${effect.value}% Equipment XP`;
        case 'upgrade_cost_percent':
            return `${effect.value > 0 ? '+' : ''}${effect.value}% Upgrade Cost`;
        case 'equipment_stats_percent':
            return `+${effect.value}% Equipment Stats`;

        // Generic percentage bonuses (used by tooltip helpers)
        case 'xp_percent':
            return `+${effect.value}% XP`;
        case 'loot_percent':
            return `+${effect.value}% Loot`;
        case 'enemy_stats_percent':
            return `Enemy Stats: +${effect.value}%`;

        default:
            // Try to generate something reasonable
            if(effect.value !== undefined) {
                return `${effect.type}: ${effect.value}`;
            }
            return effect.type || 'Unknown effect';
    }
}

/**
 * Format a trigger type into a human-readable string.
 * 
 * @param {string} trigger - Trigger type (e.g., 'round_start', 'on_kill')
 * @returns {string} Human-readable trigger description
 */
function formatTrigger(trigger) {
    if(!trigger) return '';
    
    const triggerNames = {
        'passive': 'Passive',
        'turn_start': 'At turn start',
        'turn_end': 'At turn end',
        'round_start': 'At round start',
        'round_end': 'At round end',
        'before_damage_dealt': 'Before dealing damage',
        'after_damage_dealt': 'After dealing damage',
        'before_damage_received': 'Before receiving damage',
        'after_damage_received': 'After receiving damage',
        'on_hit': 'On hit',
        'on_miss': 'On miss',
        'on_crit': 'On critical hit',
        'on_kill': 'On kill',
        'on_death': 'On death',
        'encounter_start': 'At encounter start',
        'encounter_end': 'At encounter end',
        'floor_start': 'At floor start',
        'floor_end': 'At floor end',
        'dungeon_start': 'At dungeon start',
        'dungeon_end': 'At dungeon end',
        'enemy_spawn': 'When enemy spawns',
        'ability_used': 'When ability is used',
        'party_wipe': 'When party wipes',
        'on_damage': 'When damaged'
    };
    return triggerNames[trigger] || trigger.replace(/_/g, ' ');
}

/**
 * Generate a full effect description including trigger.
 * Use this when you need "At round start: Heal 5 HP" style descriptions.
 * 
 * @param {object} effect - Effect object with type, trigger, value, etc.
 * @param {object} manager - AdventuringManager for resolving names
 * @param {object} options - Options for formatting
 * @param {boolean} options.includeTrigger - Whether to include trigger prefix (default: true)
 * @param {boolean} options.includeChance - Whether to include chance info (default: true)
 * @returns {string} Full effect description
 */
function describeEffectFull(effect, manager, options = {}) {
    const { includeTrigger = true, includeChance = true } = options;
    
    let desc = describeEffect(effect, manager);
    
    // Add trigger prefix if not passive
    if(includeTrigger && effect.trigger && effect.trigger !== 'passive') {
        desc = `${formatTrigger(effect.trigger)}: ${desc}`;
    }
    
    // Add chance suffix if present (unless it's in condition)
    if(includeChance && effect.chance && effect.chance < 100) {
        desc = `${desc} (${effect.chance}% chance)`;
    }
    
    // Add condition suffix if present
    if(effect.condition) {
        const conditionDesc = describeCondition(effect.condition, manager);
        if(conditionDesc) {
            desc = `${desc} ${conditionDesc}`;
        }
    }
    
    // Add target info if targeting enemies
    if(effect.target && effect.target !== 'self') {
        const targetNames = {
            'all_enemies': 'all enemies',
            'random_enemy': 'random enemy',
            'front_enemy': 'front enemy',
            'back_enemy': 'back enemy',
            'lowest_enemy': 'lowest HP enemy',
            'all_allies': 'all allies',
            'random_ally': 'random ally',
            'lowest_ally': 'lowest HP ally'
        };
        const targetName = targetNames[effect.target] || effect.target.replace(/_/g, ' ');
        // Only add if not already implied in the description
        if(!desc.toLowerCase().includes(targetName.toLowerCase())) {
            desc = `${desc} to ${targetName}`;
        }
    }
    
    return desc;
}

/**
 * Build replacements object from effects array for standard effect descriptions.
 * Works with auras, passives, etc. that use {effect.N.amount} format.
 * 
 * @param {Array} effects - Array of effects with getAmount/getStacks methods
 * @param {object} context - Context to pass to getAmount/getStacks (stats, instance, etc.)
 * @param {boolean} isDesc - Whether this is for description display (vs calculation)
 * @returns {object} Replacements object for parseDescription
 */
function buildEffectReplacements(effects, context, isDesc = false) {
    const replacements = {};
    effects.forEach((effect, i) => {
        if(effect.getAmount) {
            replacements[`effect.${i}.amount`] = effect.getAmount(context, isDesc);
        }
        if(effect.getStacks) {
            replacements[`effect.${i}.stacks`] = effect.getStacks(context, isDesc);
        }
    });
    return replacements;
}

/**
 * Build replacements object from ability hits for {hit.N.effect.M.amount} format.
 * 
 * @param {Array} hits - Array of ability hits containing effects
 * @param {object} stats - Stats context for getAmount/getStacks
 * @param {boolean} isDesc - Whether this is for description display
 * @returns {object} Replacements object for parseDescription
 */
function buildHitEffectReplacements(hits, stats, isDesc = false) {
    const replacements = {};
    hits.forEach((hit, i) => {
        hit.effects.forEach((effect, e) => {
            if(effect.getAmount) {
                replacements[`hit.${i}.effect.${e}.amount`] = effect.getAmount(stats, isDesc);
            }
            if(effect.getStacks) {
                replacements[`hit.${i}.effect.${e}.stacks`] = effect.getStacks(stats, isDesc);
            }
        });
    });
    return replacements;
}

// ============================================================================
// EFFECT PROCESSOR
// ============================================================================

/**
 * Centralized effect processor with registered handlers.
 * Replaces the large switch statement in character.trigger().
 */
class EffectProcessor {
    constructor() {
        /** @type {Map<string, Function>} */
        this.handlers = new Map();
    }
    
    /**
     * Register a handler for an effect type
     * @param {string} type - Effect type (e.g., 'damage', 'heal', 'buff')
     * @param {Function} handler - Handler function(effect, context) => void
     */
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    
    /**
     * Process an effect
     * @param {object} resolved - Resolved effect from aura trigger { effect, instance }
     * @param {object} context - Processing context { character, extra, manager }
     * @returns {object} Modified extra object
     */
    process(resolved, context) {
        const { effect, instance } = resolved;
        const handler = this.handlers.get(effect.type);
        
        if(handler) {
            return handler(effect, instance, context);
        }
        
        // No handler - might be handled elsewhere (like stat calculation)
        return context.extra;
    }
    
    /**
     * Process multiple resolved effects
     * @param {Array} resolvedEffects - Array of { effect, instance }
     * @param {object} context - Processing context
     * @returns {object} Modified extra object
     */
    processAll(resolvedEffects, context) {
        resolvedEffects.forEach(resolved => {
            context.extra = this.process(resolved, context);
        });
        return context.extra;
    }
}

/**
 * Create the default effect processor with all standard handlers.
 * @returns {EffectProcessor} Configured processor
 */
function createDefaultEffectProcessor() {
    const processor = new EffectProcessor();
    
    // Skip turn
    processor.register('skip', (effect, instance, ctx) => {
        ctx.extra.skip = true;
        return ctx.extra;
    });
    
    // Shield/block damage
    processor.register('reduce_amount', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const reduce = Math.min(ctx.extra.amount || 0, builtEffect.amount);
        ctx.extra.amount -= reduce;
        if(instance.base.consume) {
            instance.remove_stacks(reduce);
        }
        return ctx.extra;
    });
    
    // Damage or heal (with target resolution)
    const damageOrHeal = (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const target = effect.target || 'self';
        
        if(target === 'self' || target === undefined) {
            ctx.manager.log.add(`${ctx.character.name} receives ${builtEffect.amount} ${effect.type} from ${instance.base.name}`);
            ctx.character.applyEffect(effect, builtEffect, ctx.character);
        } else if(target === 'attacker' && ctx.extra.attacker) {
            ctx.manager.log.add(`${ctx.extra.attacker.name} receives ${builtEffect.amount} ${effect.type} from ${instance.base.name}`);
            ctx.extra.attacker.applyEffect(effect, builtEffect, ctx.character);
        }
        return ctx.extra;
    };
    processor.register('damage', damageOrHeal);
    processor.register('heal', damageOrHeal);
    
    // Stack manipulation
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
        // If effect has an age condition, it triggers that many times before removing
        // age=3 means the effect triggers at age 0, 1, 2, then removes at age 3
        if (effect.age !== undefined) {
            if (instance.age >= effect.age) {
                instance.remove();
            }
            // Otherwise the effect just triggers but doesn't remove yet
        } else {
            instance.remove();
        }
        return ctx.extra;
    });
    
    // Damage modifiers
    processor.register('increase_damage', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        ctx.extra.amount = (ctx.extra.amount || 0) + builtEffect.amount;
        return ctx.extra;
    });
    
    processor.register('increase_damage_percent', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const increase = Math.ceil((ctx.extra.amount || 0) * (builtEffect.amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });
    
    processor.register('reduce_damage_percent', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const reduction = Math.ceil((ctx.extra.amount || 0) * (builtEffect.amount / 100));
        ctx.extra.amount = Math.max(0, (ctx.extra.amount || 0) - reduction);
        return ctx.extra;
    });
    
    processor.register('reduce_heal_percent', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const reduction = Math.ceil((ctx.extra.amount || 0) * (builtEffect.amount / 100));
        ctx.extra.amount = Math.max(0, (ctx.extra.amount || 0) - reduction);
        return ctx.extra;
    });
    
    // Chance-based effects
    processor.register('chance_skip', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        if(Math.random() * 100 < builtEffect.amount) {
            ctx.extra.skip = true;
            ctx.manager.log.add(`${ctx.character.name} is overcome with ${instance.base.name}!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_dodge', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        if(Math.random() * 100 < builtEffect.amount) {
            ctx.extra.amount = 0;
            ctx.extra.dodged = true;
            ctx.manager.log.add(`${ctx.character.name} dodges the attack!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_miss', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        if(Math.random() * 100 < builtEffect.amount) {
            ctx.extra.amount = 0;
            ctx.extra.missed = true;
            ctx.manager.log.add(`${ctx.character.name} misses due to ${instance.base.name}!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_hit_ally', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        if(Math.random() * 100 < builtEffect.amount) {
            ctx.extra.hitAlly = true;
            ctx.manager.log.add(`${ctx.character.name} is confused and attacks an ally!`);
        }
        return ctx.extra;
    });
    
    // Status effects
    processor.register('untargetable', (effect, instance, ctx) => {
        ctx.extra.untargetable = true;
        return ctx.extra;
    });
    
    processor.register('prevent_debuff', (effect, instance, ctx) => {
        ctx.extra.prevented = true;
        ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} prevents the debuff!`);
        return ctx.extra;
    });
    
    processor.register('prevent_ability', (effect, instance, ctx) => {
        ctx.extra.prevented = true;
        return ctx.extra;
    });
    
    processor.register('force_target', (effect, instance, ctx) => {
        if(instance.source) {
            ctx.extra.forcedTarget = instance.source;
        }
        return ctx.extra;
    });
    
    // Lifesteal
    processor.register('lifesteal', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const healAmount = Math.ceil((ctx.extra.damageDealt || 0) * (builtEffect.amount / 100));
        if(healAmount > 0) {
            ctx.character.heal({ amount: healAmount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name} heals for ${healAmount} from ${instance.base.name}`);
        }
        return ctx.extra;
    });
    
    // XP and loot bonuses
    processor.register('increase_xp_percent', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const increase = Math.ceil((ctx.extra.amount || 0) * (builtEffect.amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });
    
    processor.register('increase_loot_percent', (effect, instance, ctx) => {
        const builtEffect = { amount: effect.getAmount(instance) };
        const increase = Math.ceil((ctx.extra.amount || 0) * (builtEffect.amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });
    
    // Note: increase_stat_percent and reduce_stat_percent are NOT registered here.
    // They use trigger: "stats" and are handled in stat calculation (adventuring-auras.mjs),
    // never through the character.trigger() method.
    
    return processor;
}

// Create the singleton processor
const defaultEffectProcessor = createDefaultEffectProcessor();

// ============================================================================
// XP BONUS UTILITY
// ============================================================================

/**
 * Add mastery XP with modifier bonus applied.
 * Consolidates the duplicate addXP pattern from jobs, monsters, areas.
 * 
 * @param {object} manager - The adventuring manager
 * @param {object} action - The mastery action (job, monster, area)
 * @param {number} baseXP - Base XP amount before modifiers
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.updateTooltip=true] - Queue tooltip render update
 */
function addMasteryXPWithBonus(manager, action, baseXP, options = {}) {
    const { updateTooltip = true } = options;
    
    // Apply mastery XP bonus from modifier system
    const xpBonus = manager.modifiers.getMasteryXPBonus(action);
    const modifiedXP = Math.floor(baseXP * (1 + xpBonus));
    
    manager.addMasteryXP(action, modifiedXP);
    manager.addMasteryPoolXP(modifiedXP);
    
    if(updateTooltip && action.renderQueue) {
        action.renderQueue.tooltip = true;
    }
    
    return modifiedXP;
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
    createEffect,
    filterEffectsByTrigger,
    filterEffectsByType,
    getStatEffects,
    EffectCache,
    // New utilities
    RequirementsChecker,
    formatRequirement,
    formatRequirements,
    parseDescription,
    describeEffect,
    describeEffectFull,
    formatTrigger,
    buildEffectReplacements,
    buildHitEffectReplacements,
    EffectProcessor,
    defaultEffectProcessor,
    addMasteryXPWithBonus,
    // Condition system
    evaluateCondition,
    describeCondition
}

