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
        // Spread original data first to preserve type-specific fields (healAmount, threshold, etc.)
        ...effectData,
        // Then apply standard field mappings (these may override spreaded values)
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
            
            case 'melvor_skill_level': {
                // Check if player has required level in a Melvor skill
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
                // Check if the required achievement is completed
                if (this.manager.achievements === undefined) return false;
                const achievement = this.manager.achievements.getObjectByID(req.id);
                return achievement ? achievement.isComplete : false;
            }

            default:
                console.warn(`Unknown requirement type: ${req.type}`);
                return false; // Fail safe: unknown requirements should block, not pass
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
        if(!character) return this._checkJobLevel(jobId, level);
        
        // Check if character has this job equipped (combat or passive)
        const hasCombatJob = character.combatJob !== undefined && character.combatJob.id === jobId;
        const hasPassiveJob = character.passiveJob !== undefined && character.passiveJob.id === jobId;
        
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
        const combatMatch = character.combatJob !== undefined && character.combatJob.id === jobId;
        const passiveMatch = character.passiveJob !== undefined && character.passiveJob.id === jobId;
        return combatMatch || passiveMatch;
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
        const target = req.value !== undefined ? req.value : req.amount;
        
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
                const count = this.manager.stash.materialCounts.get(material);
                value = count !== undefined ? count : 0;
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
            const areaName = area !== undefined ? area.name : req.area;
            text = `${areaName} Mastery ${req.level}`;
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
 * Get the display name for an aura/buff/debuff.
 * Looks up the aura in the registry and falls back to prettifying the ID.
 * 
 * @param {object} manager - AdventuringManager for lookups
 * @param {string} auraId - The aura ID to look up
 * @returns {string} Human-readable aura name
 */
function getAuraName(manager, auraId) {
    if (!auraId) return 'Unknown';
    if (manager === undefined || manager.auras === undefined) {
        return auraId.split(':').pop() || 'Unknown';
    }
    const aura = manager.auras.getObjectByID(auraId);
    return aura !== undefined ? aura.name : (auraId.split(':').pop() || 'Unknown');
}

/**
 * Effect description registry - maps effect types to description generator functions.
 * Each function receives: (effect, value, stacks, amount, manager, helpers)
 * - effect: The full effect object
 * - value: Resolved value (effect.value ?? amount)
 * - stacks: Resolved stacks count
 * - amount: Resolved amount
 * - manager: AdventuringManager for lookups
 * - helpers: { sign, percent, stat, aura, prettify }
 */
const effectDescriptionRegistry = new Map([
    // Stat modifiers
    ['increase_stat_flat', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack 
            ? `+${value ?? amount ?? 1} ${helpers.stat(effect.stat || effect.id)} per stack` 
            : `${helpers.sign(value)}${value} ${helpers.stat(effect.stat || effect.id)}`],
    ['increase_stat_percent', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack 
            ? `+${value ?? amount ?? 1}% ${helpers.stat(effect.stat || effect.id)} per stack` 
            : `${helpers.sign(value)}${value}% ${helpers.stat(effect.stat || effect.id)}`],
    
    // Damage/Healing
    ['damage', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack ? `Deal ${value ?? amount ?? 1} damage per stack` : `Deal ${value ?? amount ?? '?'} damage`],
    ['heal', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack ? `Heal ${value ?? amount ?? effect.count ?? 1} HP per stack` : `Heal ${value ?? amount ?? effect.count ?? '?'} HP`],
    ['heal_percent', (effect, value, stacks, amount, manager, helpers) => 
        `Restore ${helpers.percent(value ?? amount)}% HP`],
    ['lifesteal', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack 
            ? `Heal ${helpers.percent(value ?? amount ?? 0)}% of damage per stack` 
            : `Heal for ${helpers.percent(value ?? amount ?? 0)}% of damage dealt`],
    
    // Damage modifiers
    ['damage_buff', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack ? `+${value ?? amount ?? 1} Damage per stack` : `${helpers.sign(value ?? amount)}${value ?? amount} Damage`],
    ['increase_damage', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack ? `+${value ?? amount ?? 1} Damage per stack` : `${helpers.sign(value ?? amount)}${value ?? amount} Damage`],
    ['increase_damage_percent', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack ? `+${value ?? amount ?? 1}% Damage per stack` : `${helpers.sign(value ?? amount)}${value ?? amount}% Damage`],
    ['reduce_stat_percent', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack 
            ? `-${value ?? amount ?? 1}% ${helpers.stat(effect.id)} per stack` 
            : `-${value ?? amount}% ${helpers.stat(effect.id)}`],
    ['defense_buff', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.sign(value ?? amount)}${value ?? amount} Defense`],
    ['speed_buff', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.sign(value ?? amount)}${value ?? amount} Speed`],
    
    // Buffs/Debuffs
    ['buff', (effect, value, stacks, amount, manager, helpers) => 
        `Apply ${stacks ?? 1} ${helpers.aura(effect.id || effect.aura || effect.buff)}`],
    ['debuff', (effect, value, stacks, amount, manager, helpers) => 
        `Apply ${stacks ?? 1} ${helpers.aura(effect.id || effect.aura || effect.debuff)}`],
    ['cleanse', (effect, value, stacks, amount, manager, helpers) => 
        effect.id ? `Remove ${helpers.aura(effect.id)}` : 'Cleanse debuffs'],
    
    // Energy
    ['energy', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.sign(value ?? amount)}${value ?? amount} Energy`],
    ['energy_gain_bonus', (effect, value, stacks, amount, manager, helpers) => 
        `+${value}% energy from generators`],
    
    // Multipliers
    ['xp_multiplier', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.sign((value - 1) * 100)}${Math.round((value - 1) * 100)}% XP`],
    ['loot_multiplier', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.sign((value - 1) * 100)}${Math.round((value - 1) * 100)}% Loot`],
    ['enemy_stat_multiplier', (effect, value, stacks, amount, manager, helpers) => 
        `Enemy Stats: ${helpers.sign((value - 1) * 100)}${Math.round((value - 1) * 100)}%`],
    
    // Revival
    ['revive', (effect, value, stacks, amount, manager, helpers) => 
        `Revive with ${amount ?? effect.hpPercent ?? 100}% HP`],
    ['revive_all', (effect, value, stacks, amount, manager, helpers) => 
        `Revive with ${amount ?? effect.hpPercent ?? 100}% HP`],
    
    // Tile effects
    ['teleport', () => 'Teleport to a random tile'],
    ['loot', () => 'Contains random loot'],
    ['xp', (effect, value, stacks, amount, manager, helpers) => `Grant ${amount ?? value} Job XP`],
    
    // Percentage-based damage
    ['damage_percent', (effect, value, stacks, amount, manager, helpers) => 
        `Deal ${amount ?? value}% HP damage`],
    ['damage_bonus', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% damage`],
    ['damage_reduction', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.percent(value)}% damage reduction`],
    
    // Immunity
    ['immunity', (effect, value, stacks, amount, manager, helpers) => {
        const immuneTo = effect.debuff || effect.id;
        return immuneTo ? `Immune to ${helpers.aura(immuneTo)}` : 'Immune to debuffs';
    }],
    
    // Crit
    ['crit_chance', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% critical chance`],
    ['crit_damage', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% critical damage`],
    
    // Cost/Dodge
    ['cost_reduction', (effect, value, stacks, amount, manager, helpers) => 
        `-${helpers.percent(value)}% ability cost`],
    ['dodge_chance', (effect, value, stacks, amount, manager, helpers) => 
        `${helpers.percent(value)}% dodge chance`],
    
    // Healing modifiers
    ['healing_bonus', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% healing done`],
    ['healing_received', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% healing received`],
    
    // Reflect
    ['reflect_damage', (effect, value, stacks, amount, manager, helpers) => 
        effect.perStack 
            ? `Reflect ${helpers.percent(amount ?? value)}% damage per stack` 
            : `Reflect ${helpers.percent(value ?? amount)}% damage taken`],
    
    // Spell echo
    ['spell_echo', (effect, value, stacks, amount, manager, helpers) => 
        `${effect.chance ?? value}% chance to cast spells twice`],
    
    // Execute
    ['execute', (effect, value, stacks, amount, manager, helpers) => 
        `Execute enemies below ${helpers.percent(effect.threshold ?? value ?? 20)}% HP`],
    
    // All stat bonus
    ['all_stat_bonus', (effect, value, stacks, amount, manager, helpers) => 
        `+${value}% all stats`],
    
    // Party healing
    ['heal_party_percent', (effect, value, stacks, amount, manager, helpers) => 
        `Heal party for ${value}% max HP`],
    
    // Random buffs/debuffs
    ['random_buffs', (effect, value, stacks, amount, manager, helpers) => {
        const count = effect.count ?? 1;
        const stackCount = stacks ?? 1;
        return count === 1 
            ? `Apply a random buff (${stackCount} stack${stackCount !== 1 ? 's' : ''})` 
            : `Apply ${count} random buffs (${stackCount} stack${stackCount !== 1 ? 's' : ''} each)`;
    }],
    ['random_debuffs', (effect, value, stacks, amount, manager, helpers) => {
        const count = effect.count ?? 1;
        const stackCount = stacks ?? 1;
        return count === 1 
            ? `Apply a random debuff (${stackCount} stack${stackCount !== 1 ? 's' : ''})` 
            : `Apply ${count} random debuffs (${stackCount} stack${stackCount !== 1 ? 's' : ''} each)`;
    }],
    
    // Dispel effects
    ['dispel', (effect, value, stacks, amount, manager, helpers) => {
        const dispelCount = effect.count || 1;
        return dispelCount === 'all' ? 'Remove all buffs from target' : `Remove ${dispelCount} buff${dispelCount !== 1 ? 's' : ''} from target`;
    }],
    ['dispel_buff', (effect, value, stacks, amount, manager, helpers) => {
        const dispelCount = effect.count || 1;
        return dispelCount === 'all' ? 'Remove all buffs from target' : `Remove ${dispelCount} buff${dispelCount !== 1 ? 's' : ''} from target`;
    }],
    ['dispel_debuff', (effect, value, stacks, amount, manager, helpers) => {
        const debuffCount = effect.count || 1;
        return debuffCount === 'all' ? 'Cleanse all debuffs' : `Cleanse ${debuffCount} debuff${debuffCount !== 1 ? 's' : ''}`;
    }],
    
    // Enemy stat debuff
    ['enemy_stat_debuff', (effect, value, stacks, amount, manager, helpers) => {
        const debuffVal = Math.abs(helpers.percent(value ?? amount ?? 0));
        return `Reduce enemy ${helpers.stat(effect.stat || effect.id)} by ${debuffVal}%`;
    }],
    
    // Cleanse variants
    ['cleanse_debuff', (effect, value, stacks, amount, manager, helpers) => {
        const cleanseCount = effect.count || 1;
        return cleanseCount === 1 ? 'Cleanse a debuff' : `Cleanse ${cleanseCount} debuffs`;
    }],
    ['cleanse_random_debuff', (effect, value, stacks, amount, manager, helpers) => {
        const cleanseCount = effect.count || 1;
        return cleanseCount === 1 ? 'Cleanse a debuff' : `Cleanse ${cleanseCount} debuffs`;
    }],
    
    // Summon effects
    ['summon', () => 'Summon a companion'],
    ['summon_power_bonus', (effect, value) => `+${value}% summon power`],
    ['summon_attack_speed', (effect, value) => `+${value}% summon attack speed`],
    
    // Ward/Charm
    ['ward', (effect, value, stacks) => `Block next ${stacks ?? 1} attacks`],
    ['charm', (effect) => `Charm target for ${effect.duration || 1} turns`],
    
    // Double cast
    ['double_cast', (effect, value) => `${effect.chance ?? value}% chance to cast twice`],
    
    // Mastery unlocks
    ['unlock_auto_run', () => 'Unlock Auto-Run'],
    ['unlock_difficulty', (effect) => {
        const diffId = effect.difficultyID?.split(':').pop() || 'Unknown';
        return `Unlock ${diffId.charAt(0).toUpperCase() + diffId.slice(1)} Mode`;
    }],
    ['unlock_mastery_aura', () => 'Unlock Mastery Aura'],
    ['unlock_multi_job_assignment', () => 'Unlock Multi-Job Assignment'],
    ['unlock_mastered_variant', () => 'Unlock Mastered Variant'],
    
    // Mastery stat bonuses
    ['job_stats_percent', (effect, value) => `+${value}% Job Stats`],
    ['drop_rate_percent', (effect, value) => `+${value}% Drop Rate`],
    ['drop_quantity_percent', (effect, value) => `+${value}% Drop Quantity`],
    ['explore_speed_percent', (effect, value) => `+${value}% Explore Speed`],
    ['trap_spawn_rate_percent', (effect, value) => `${value > 0 ? '+' : ''}${value}% Trap Spawn Rate`],
    ['fountain_spawn_rate_percent', (effect, value) => `+${value}% Fountain Spawn Rate`],
    ['treasure_spawn_rate_percent', (effect, value) => `+${value}% Treasure Spawn Rate`],
    ['shrine_spawn_rate_percent', (effect, value) => `+${value}% Shrine Spawn Rate`],
    ['ability_learn_chance_percent', (effect, value) => `+${value}% Ability Learn Chance`],
    ['equipment_xp_percent', (effect, value) => `+${value}% Equipment XP`],
    ['upgrade_cost_percent', (effect, value) => `${value > 0 ? '+' : ''}${value}% Upgrade Cost`],
    ['equipment_stats_percent', (effect, value) => `+${value}% Equipment Stats`],
    
    // Generic percentage bonuses
    ['xp_percent', (effect, value) => `+${value}% XP`],
    ['loot_percent', (effect, value) => `+${value}% Loot`],
    ['enemy_stats_percent', (effect, value) => `Enemy Stats: +${value}%`],
    
    // Consumable effects
    ['heal_on_low_hp', (effect, value, stacks, amount) => 
        `Heal ${amount ?? effect.healAmount ?? '?'} HP when below ${effect.threshold ?? '?'}% HP`],
    ['proc_debuff', (effect, value, stacks, amount, manager, helpers) => {
        const debuffName = manager?.auras?.getObjectByID(effect.debuff)?.name || effect.debuff?.split(':').pop() || 'Unknown';
        return `${effect.chance ?? '?'}% chance to apply ${stacks ?? 1} ${debuffName}`;
    }],
    ['heal_on_floor_start', (effect, value, stacks, amount) => 
        `Heal ${amount ?? effect.healAmount ?? '?'} HP at floor start`],
    ['heal_after_combat', (effect, value, stacks, amount) => 
        `Heal ${amount ?? effect.healAmount ?? '?'} HP after combat`],
    ['on_damage', (effect) => 
        `Heal ${effect.heal_percent ?? effect.healPercent ?? 0}% of damage dealt`],
    
    // Aura internal effects
    ['remove', () => ''],
    ['remove_stacks', (effect, value, stacks, amount) => `Remove ${effect.count ?? amount ?? 1} stack(s)`],
    ['reduce_amount', (effect, value, stacks, amount) => `Reduce damage by ${amount ?? 1} per stack`],
    ['absorb_damage', (effect, value, stacks, amount) => `Absorb ${amount ?? 1} damage per stack`],
    ['skip', () => 'Skip turn'],
    ['chance_skip', (effect, value, stacks, amount) => `${amount ?? 0}% chance to skip turn`],
    ['untargetable', () => 'Cannot be targeted'],
    ['evade', () => 'Evade next attack'],
    ['chance_dodge', (effect, value, stacks, amount) => `${amount ?? 0}% chance to dodge`],
    ['chance_miss', (effect, value, stacks, amount) => `${amount ?? 0}% chance to miss`],
    ['chance_hit_ally', (effect, value, stacks, amount) => `${amount ?? 0}% chance to hit ally instead`],
    ['force_target', () => 'Force enemies to target this character'],
    ['prevent_ability', () => 'Cannot use spenders'],
    ['prevent_debuff', () => 'Immune to next debuff'],
    ['prevent_lethal', () => 'Cannot be killed'],
    ['prevent_death', (effect) => 
        `Prevent death${effect.healPercent ? `, heal ${Math.round(effect.healPercent * 100)}% HP` : ''}`],
    ['reduce_damage_percent', (effect, value, stacks, amount) => 
        `${amount ?? 0}% damage reduction${effect.perStack ? ' per stack' : ''}`],
    ['reduce_heal_percent', (effect, value, stacks, amount) => 
        `-${amount ?? 0}% healing received${effect.perStack ? ' per stack' : ''}`],
    ['heal_party', (effect, value, stacks, amount) => `Heal party for ${amount ?? 0} HP`],
    
    // Chaos effects
    ['chaos_damage', (effect) => 
        `Chaotic damage (${effect.bonusDamageChance || 0}% bonus, ${effect.healEnemyChance || 0}% heal enemy)`],
    
    // Percentage stat modifiers
    ['ability_damage_percent', (effect, value, stacks, amount) => `+${amount ?? 0}% ability damage`],
    ['buff_damage', (effect, value, stacks, amount) => `+${amount ?? 0} damage`],
    
    // Immunities
    ['effect_immunity', (effect) => {
        const effects = effect.effects || [effect.effect];
        return `Immune to ${effects.join(', ')}`;
    }],
    ['immune_displacement', () => 'Immune to displacement'],
    ['prevent_enemy_teleport', () => 'Enemies cannot teleport'],
    
    // Buff application
    ['apply_effect', (effect, value) => 
        `Apply ${effect.effect}${effect.chance ? ` (${effect.chance}% chance)` : ''}`],
    
    // Stat/passive bonuses
    ['stat_bonus', (effect, value, stacks, amount, manager, helpers) => {
        const statBonusName = helpers.stat(effect.stat) !== 'Unknown' 
            ? helpers.stat(effect.stat) 
            : (effect.stat?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Stat');
        return `+${value}% ${statBonusName}`;
    }],
    ['modifier', (effect, value, stacks, amount, manager, helpers) => {
        const passiveId = typeof effect.passive === 'string' ? effect.passive : effect.passive?.id;
        const passiveName = manager?.passives?.getObjectByID(passiveId)?.name 
            || effect.passive?.name 
            || passiveId?.split(':').pop() 
            || 'modifier';
        return `Apply ${passiveName}`;
    }],
    ['resistance', (effect, value, stacks, amount, manager, helpers) => {
        const element = effect.element?.charAt(0).toUpperCase() + effect.element?.slice(1) || 'Elemental';
        return `+${helpers.percent(value)}% ${element} Resistance`;
    }],
    ['all_resistance', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% All Resistance`],
    ['reflect', (effect, value, stacks, amount, manager, helpers) => 
        `Reflect ${helpers.percent(value)}% damage`],
    
    // XP/Loot bonuses
    ['xp_bonus', (effect, value) => `+${value}% XP`],
    ['loot_bonus', (effect, value) => `+${value}% Loot`],
    ['loot_quality_bonus', (effect, value) => `+${value}% Loot Quality`],
    ['rare_drop_bonus', (effect, value) => `+${value}% Rare Drop Chance`],
    ['material_drop_bonus', (effect, value) => `+${value}% Material Drops`],
    
    // Energy bonuses
    ['energy_bonus', (effect, value) => `+${value}% Energy`],
    ['energy_regen_bonus', (effect, value) => `+${value}% Energy Regen`],
    
    // Damage bonuses
    ['spell_damage_bonus', (effect, value, stacks, amount, manager, helpers) => 
        `+${helpers.percent(value)}% Spell Damage`],
    ['extra_target', (effect, value) => `Hit ${value} extra target(s)`],
    ['damage_bonus_vs_debuff', (effect, value) => `+${value}% damage vs debuffed enemies`],
    
    // Duration modifiers
    ['debuff_duration_reduction', (effect, value) => `${value}% shorter debuff duration`],
    
    // Enemy buffs
    ['enemy_buff', (effect, value, stacks, amount, manager, helpers) => 
        `Enemies gain ${stacks ?? 1} ${helpers.aura(effect.id)}`],
]);

/**
 * Generate a human-readable description for an effect.
 * Centralizes effect description logic for use across tooltips, logs, etc.
 * 
 * @param {object} effect - Effect object with type, value, stat, etc.
 * @param {object} manager - AdventuringManager for resolving stat names
 * @param {string|boolean} displayMode - Display mode: 'total', 'scaled', 'multiplier', or legacy boolean
 * @returns {string} Human-readable description
 */
function describeEffect(effect, manager, displayMode = false) {
    if(!effect) return '';
    
    // If effect has explicit description, use it
    if(effect.description) return effect.description;
    
    const sign = (val) => val >= 0 ? '+' : '';
    // Convert decimal to percentage if needed (0.25 -> 25, but 25 stays 25)
    const toPercent = (val) => {
        if (val === undefined || val === null) return 0;
        return Math.abs(val) < 1 && val !== 0 ? Math.round(val * 100) : val;
    };
    
    // Extract value from effect - handles both raw data and AdventuringScalableEffect objects
    // displayMode controls how scaling is shown: 'total', 'scaled', 'multiplier', or false for raw
    const getVal = (key) => {
        const raw = effect[key];
        if (raw === undefined || raw === null) return undefined;
        // If it's a primitive, use it directly
        if (typeof raw !== 'object') return raw;
        // If effect has a method for this value, use it
        const methodName = key === 'amount' ? 'getAmount' : key === 'stacks' ? 'getStacks' : null;
        if (methodName && typeof effect[methodName] === 'function') {
            // Pass displayMode; use 'multiplier' as default for descriptions if no mode specified
            return effect[methodName](null, displayMode !== false ? displayMode : 'multiplier');
        }
        // If it's an object with a base property (scalable format), use base
        if (raw.base !== undefined) return raw.base;
        // Last resort
        return raw;
    };
    
    // Convenience getters for common fields
    const amount = getVal('amount');
    const stacks = getVal('stacks');
    const value = effect.value ?? amount; // value takes precedence if present
    
    const statName = (statId) => {
        const stat = manager?.stats?.getObjectByID(statId);
        // Return the actual name if found, otherwise return the raw ID for prettifying later
        return stat?.name || null;
    };
    // Prettify a stat ID (e.g., 'xp_bonus' -> 'XP Bonus', 'all' -> 'All Stats')
    const prettifyStatId = (statId) => {
        // Handle special cases
        if (statId === 'all') return 'All Stats';
        return statId?.split(':').pop()?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
    };
    // Get stat name with fallback to prettified ID
    const getStatDisplay = (statId) => statName(statId) || prettifyStatId(statId);
    const auraName = (auraId) => {
        const aura = manager?.auras?.getObjectByID(auraId);
        return aura?.name || auraId?.split(':').pop() || 'Unknown';
    };
    
    // Build helpers object for registry functions
    const helpers = {
        sign,
        percent: toPercent,
        stat: getStatDisplay,
        aura: auraName,
        prettify: prettifyStatId
    };
    
    // Look up description generator from registry
    const describer = effectDescriptionRegistry.get(effect.type);
    if (describer) {
        return describer(effect, value, stacks, amount, manager, helpers);
    }
    
    // Fallback for unknown effect types
    if (effect.value !== undefined) {
        return `${effect.type}: ${value}`;
    }
    return effect.type || 'Unknown effect';
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
 * Format target type into human-readable text.
 * Handles both simple targets and target+party combinations.
 * 
 * @param {string} target - Target type (e.g., 'front', 'all', 'random')
 * @param {string} party - Party type (e.g., 'enemy', 'ally')
 * @returns {string} Human-readable target description
 */
function formatTarget(target, party) {
    if(!target || target === 'self') return '';
    
    // Map of target types to human-readable base names
    const targetNames = {
        // Simple targets (no party needed)
        'self': 'self',
        'attacker': 'attacker',
        'target': 'target',
        'hit_target': 'target',
        'heal_target': 'target',
        'dead': 'dead',
        
        // Position-based targets
        'front': 'front',
        'back': 'back',
        
        // Selection-based targets
        'all': 'all',
        'random': 'random',
        'lowest': 'lowest HP'
    };
    
    // Check for explicit mapping first
    if(targetNames[target]) {
        const baseName = targetNames[target];
        // If the base name is a special target that doesn't need party info, return as-is
        if(baseName === 'attacker' || baseName === 'target') {
            return baseName;
        }
        // Combine with party if provided, default to 'enemy' for combat targets
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
        if(effectiveParty === 'ally') {
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
    
    // Fallback: replace underscores with spaces
    return target.replace(/_/g, ' ');
}

/**
 * Generate a full effect description including trigger and target.
 * Trigger is placed naturally at the end: "Deal 10 damage when hit" instead of "On hit: Deal 10 damage"
 * 
 * @param {object} effect - Effect object with type, trigger, value, etc.
 * @param {object} manager - AdventuringManager for resolving names
 * @param {object} options - Options for formatting
 * @param {boolean} options.includeTrigger - Whether to include trigger info (default: true)
 * @param {boolean} options.includeChance - Whether to include chance info (default: true)
 * @param {string} options.target - Target from parent hit (if effect doesn't have one)
 * @param {string} options.party - Party from parent hit (if effect doesn't have one)
 * @param {string|boolean} options.displayMode - Display mode: 'total', 'scaled', 'multiplier', or false
 * @returns {string} Full effect description
 */
function describeEffectFull(effect, manager, options = {}) {
    const { includeTrigger = true, includeChance = true, displayMode = false } = options;
    
    let desc = describeEffect(effect, manager, displayMode);
    
    // Add target info - use effect's target or fall back to options
    const target = effect.target || options.target;
    const party = effect.party || options.party;
    
    // For self-targeting damage, explicitly say "to self"
    if (target === 'self' && effect.type === 'damage') {
        desc = `${desc} to self`;
    } else if(target && target !== 'self') {
        const targetName = formatTarget(target, party);
        // Only add if not already implied in the description
        if(targetName && !desc.toLowerCase().includes(targetName.toLowerCase())) {
            desc = `${desc} to ${targetName}`;
        }
    }
    
    // Add chance if present (unless it's 100% or already shown in description)
    const chance = effect.chance || options.chance;
    if(includeChance && chance && chance < 100 && !desc.includes('% chance')) {
        desc = `${desc} (${chance}% chance)`;
    }
    
    // Add condition suffix if present
    if(effect.condition) {
        const conditionDesc = describeCondition(effect.condition, manager);
        if(conditionDesc) {
            desc = `${desc} ${conditionDesc}`;
        }
    }
    
    // Add trigger as a natural suffix (not a prefix)
    // Skip if the description already contains condition text like "when below X%" to avoid "when below 50% HP when damaged"
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

/**
 * Format a trigger as a suffix phrase for natural reading.
 * E.g., "on_kill" -> "on kill", "round_start" -> "each round"
 * 
 * @param {string} trigger - Trigger type
 * @returns {string} Natural suffix phrase
 */
function formatTriggerSuffix(trigger) {
    if(!trigger || trigger === 'passive' || trigger === 'on_use') return '';
    
    const suffixes = {
        'turn_start': 'each turn',
        'turn_end': 'at the end of the turn',
        'round_start': 'each round',
        'round_end': 'at the end of the round',
        'before_damage_dealt': 'before dealing damage',
        'before_damage_delivered': 'before dealing damage',
        'after_damage_dealt': 'after dealing damage',
        'after_damage_delivered': 'after dealing damage',
        'before_damage_received': 'before taking damage',
        'after_damage_received': 'after taking damage',
        'on_hit': 'on hit',
        'on_miss': 'on miss',
        'on_crit': 'on critical hit',
        'on_kill': 'on kill',
        'on_death': 'on death',
        'encounter_start': 'at the start of combat',
        'encounter_end': 'at the end of combat',
        'floor_start': 'at the start of a floor',
        'floor_end': 'at the end of the floor',
        'dungeon_start': 'at the start of a dungeon',
        'dungeon_end': 'at the end of the dungeon',
        'enemy_spawn': 'when an enemy spawns',
        'ability_used': 'when using an ability',
        'party_wipe': 'when the party wipes',
        'on_damage': 'when damaged',
        'low_health': 'when low on health',
        'on_low_health': 'when low on health',
        'on_ally_death': 'when an ally dies',
        'ally_death': 'when an ally dies',
        'on_heal': 'when healing',
        'on_generator': 'when using a generator',
        'on_spender': 'when using a spender',
        'on_dodge': 'when dodging',
        'on_debuff_applied': 'when debuffed',
        'on_spell_cast': 'when casting a spell',
        'on_spell_hit': 'when a spell hits',
        'on_fatal_hit': 'on fatal hit',
        'on_attack': 'on attack',
        'on_ability': 'when using an ability',
        'on_damage_taken': 'when taking damage',
        'xp_gain': 'when gaining XP',
        'loot_roll': 'when rolling loot',
        'stats': '',  // Internal trigger, don't show
        'targeting': '',  // Internal trigger, don't show
        'death': '',  // Internal, handled separately
        'before_debuff_received': 'before receiving a debuff',
        'before_heal_received': 'before receiving a heal',
        'before_spender_cast': 'before using a spender',
        'after_ability_cast': 'after using an ability'
    };
    
    return suffixes[trigger] ?? trigger.replace(/_/g, ' ');
}

/**
 * Combine multiple effects into a single description with "and".
 * Also handles aura-specific cleanup by summarizing removal effects.
 * 
 * When effects share the same target and trigger, factors them out:
 * "Deal 10 damage and apply 2 Bleeding to front enemy" instead of
 * "Deal 10 damage to front enemy and apply 2 Bleeding to front enemy"
 * 
 * @param {Array} effects - Array of effects
 * @param {object} manager - AdventuringManager
 * @param {object} options - Options passed to describeEffectFull
 * @param {boolean} options.isAura - Whether this is for an aura (filters removal effects)
 * @returns {string} Combined description
 */
function describeEffects(effects, manager, options = {}) {
    if (!effects || effects.length === 0) return '';
    
    const { isAura = false } = options;
    
    // Separate main effects from cleanup effects (for auras)
    let mainEffects = effects;
    
    if (isAura) {
        mainEffects = effects.filter(e => {
            // Filter out removal/cleanup effects for auras
            if (e.type === 'remove' || e.type === 'remove_stacks') {
                return false;  // Always hide remove/remove_stacks for auras
            }
            return true;
        });
    }
    
    // Helper to get effective target/trigger for an effect
    const getTarget = (e) => e.target || options.target;
    const getParty = (e) => e.party || options.party;
    const getTrigger = (e) => e.trigger || options.trigger;
    
    // Check if all effects share the same target and trigger
    const firstTarget = getTarget(mainEffects[0]);
    const firstParty = getParty(mainEffects[0]);
    const firstTrigger = getTrigger(mainEffects[0]);
    
    const allSameTarget = mainEffects.every(e => 
        getTarget(e) === firstTarget && getParty(e) === firstParty
    );
    const allSameTrigger = mainEffects.every(e => getTrigger(e) === firstTrigger);
    
    // Helper to lowercase the first letter (for combining with "and")
    const lowercaseFirst = (str) => str.charAt(0).toLowerCase() + str.slice(1);
    
    let combined;
    
    if (allSameTarget && allSameTrigger) {
        // Factor out shared target and trigger - describe effects without them first
        const descriptions = mainEffects.map(e => 
            describeEffectFull(e, manager, { 
                ...options, 
                includeTrigger: false,
                // Don't add target in individual descriptions
                target: null,
                party: null
            })
        );
        
        // Combine effect descriptions
        if (descriptions.length === 1) {
            combined = descriptions[0];
        } else if (descriptions.length === 2) {
            combined = `${descriptions[0]} and ${lowercaseFirst(descriptions[1])}`;
        } else {
            const first = descriptions.shift();
            const last = descriptions.pop();
            const middle = descriptions.map(d => lowercaseFirst(d)).join(', ');
            combined = `${first}, ${middle}, and ${lowercaseFirst(last)}`;
        }
        
        // Add shared target at the end
        if (firstTarget && firstTarget !== 'self') {
            const targetName = formatTarget(firstTarget, firstParty);
            if (targetName && !combined.toLowerCase().includes(targetName.toLowerCase())) {
                combined = `${combined} to ${targetName}`;
            }
        }
        
        // Add shared trigger at the end
        if (firstTrigger && firstTrigger !== 'passive' && firstTrigger !== 'on_use') {
            const triggerSuffix = formatTriggerSuffix(firstTrigger);
            if (triggerSuffix && !combined.toLowerCase().includes('when below') && !combined.toLowerCase().includes('when above')) {
                combined = `${combined} ${triggerSuffix}`;
            }
        }
    } else {
        // Different targets/triggers - describe each fully
        const descriptions = mainEffects.map(e => describeEffectFull(e, manager, options));
        
        if (descriptions.length === 1) {
            combined = descriptions[0];
        } else if (descriptions.length === 2) {
            combined = `${descriptions[0]} and ${lowercaseFirst(descriptions[1])}`;
        } else {
            const first = descriptions.shift();
            const last = descriptions.pop();
            const middle = descriptions.map(d => lowercaseFirst(d)).join(', ');
            combined = `${first}, ${middle}, and ${lowercaseFirst(last)}`;
        }
    }
    
    return combined;
}

/**
 * Build replacements object from effects array for standard effect descriptions.
 * Works with auras, passives, etc. that use {effect.N.amount} format.
 * 
 * @param {Array} effects - Array of effects with getAmount/getStacks methods
 * @param {object} context - Context to pass to getAmount/getStacks (stats, instance, etc.)
 * @param {string|boolean} displayMode - Display mode: 'total', 'scaled', 'multiplier', or legacy boolean
 * @returns {object} Replacements object for parseDescription
 */
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

/**
 * Build replacements object from ability hits for {hit.N.effect.M.amount} format.
 * 
 * @param {Array} hits - Array of ability hits containing effects
 * @param {object} stats - Stats context for getAmount/getStacks
 * @param {string|boolean} displayMode - Display mode: 'total', 'scaled', 'multiplier', or legacy boolean
 * @returns {object} Replacements object for parseDescription
 */
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

// ============================================================================
// EFFECT PROCESSOR
// ============================================================================

/**
 * Simple effect instance wrapper for equipment/consumable effects.
 * Provides the same interface as aura instances so both can use the unified processor.
 */
class SimpleEffectInstance {
    constructor(amount, sourceName, stacks = 1) {
        this.amount = amount;
        this.stacks = stacks;
        this.base = { name: sourceName, consume: false };
        this.source = null;
        this.age = 0;
        this._isSimple = true; // Flag to identify simple instances
    }
    
    // No-op for simple instances (no stack management)
    remove_stacks(count) { }
    remove() { }
}

/**
 * Get the amount from an effect, handling both aura effects (with getAmount method)
 * and simple effects (raw JSON with amount property).
 * @param {object} effect - The effect object
 * @param {object} instance - The effect instance (aura or simple)
 * @returns {number} The calculated amount
 */
function getEffectAmount(effect, instance) {
    // Simple instance - amount is pre-calculated and stored on instance
    if(instance._isSimple) {
        return instance.amount;
    }
    // Aura effect - use getAmount method if available
    if(effect.getAmount) {
        return effect.getAmount(instance);
    }
    // Fallback to raw amount
    return effect.amount || 0;
}

/**
 * Centralized effect processor with registered handlers.
 * Handles effects from auras, equipment, and consumables with a unified interface.
 */
class EffectProcessor {
    constructor() {
        /** @type {Map<string, Function>} */
        this.handlers = new Map();
    }
    
    /**
     * Register a handler for an effect type
     * @param {string} type - Effect type (e.g., 'damage', 'heal', 'buff')
     * @param {Function} handler - Handler function(effect, instance, context) => extra
     */
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    
    /**
     * Process an effect from an aura (has instance with getAmount method)
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
     * Process an effect from equipment/consumables (pre-calculated amount)
     * @param {object} effect - The effect object
     * @param {number} amount - Pre-calculated effect amount
     * @param {string} sourceName - Name of the source for logging
     * @param {object} context - Processing context { character, extra, manager }
     * @returns {object} Modified extra object
     */
    processSimple(effect, amount, sourceName, context) {
        const handler = this.handlers.get(effect.type);
        
        if(handler) {
            // Create a simple instance wrapper
            const instance = new SimpleEffectInstance(amount, sourceName, effect.stacks || 1);
            return handler(effect, instance, context);
        }
        
        return context.extra;
    }
    
    /**
     * Process multiple resolved effects from auras
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
    
    // Shield/block damage (flat amount)
    processor.register('reduce_amount', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const reduce = Math.min(ctx.extra.amount || 0, amount);
        ctx.extra.amount -= reduce;
        if(instance.base && instance.base.consume) {
            instance.remove_stacks(reduce);
        }
        return ctx.extra;
    });
    
    // Damage or heal (with target resolution)
    const damageOrHeal = (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const builtEffect = { amount };
        const target = effect.target || 'self';
        
        if(target === 'self' || target === undefined) {
            ctx.manager.log.add(`${ctx.character.name} receives ${amount} ${effect.type} from ${instance.base.name}`);
            ctx.character.applyEffect(effect, builtEffect, ctx.character);
        } else if(target === 'attacker' && ctx.extra.attacker) {
            ctx.manager.log.add(`${ctx.extra.attacker.name} receives ${amount} ${effect.type} from ${instance.base.name}`);
            ctx.extra.attacker.applyEffect(effect, builtEffect, ctx.character);
        } else if(target === 'target' && ctx.extra.target) {
            ctx.manager.log.add(`${ctx.extra.target.name} receives ${amount} ${effect.type} from ${instance.base.name}`);
            ctx.extra.target.applyEffect(effect, builtEffect, ctx.character);
        }
        return ctx.extra;
    };
    processor.register('damage', damageOrHeal);
    processor.register('heal', damageOrHeal);
    
    // Heal percent of max HP
    processor.register('heal_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const healAmount = Math.ceil(ctx.character.maxHitpoints * (amount / 100));
        ctx.character.heal({ amount: healAmount }, ctx.character);
        ctx.manager.log.add(`${ctx.character.name} heals for ${healAmount} from ${instance.base.name}`);
        return ctx.extra;
    });
    
    // Heal entire party for percent of max HP
    processor.register('heal_party_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(ctx.manager.party) {
            ctx.manager.party.heroes.forEach(hero => {
                if(!hero.dead) {
                    const healAmount = Math.ceil(hero.maxHitpoints * (amount / 100));
                    hero.heal({ amount: healAmount }, ctx.character);
                }
            });
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} heals the party`);
        }
        return ctx.extra;
    });
    
    // Apply buff aura
    processor.register('buff', (effect, instance, ctx) => {
        const stacks = instance.stacks || effect.stacks || 1;
        const builtEffect = { stacks };
        const target = effect.target || 'self';
        
        if(target === 'self' || target === undefined) {
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} applies ${effect.id}`);
            ctx.character.auras.add(effect.id, builtEffect, ctx.character);
        } else if(target === 'attacker' && ctx.extra.attacker) {
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} applies ${effect.id} to ${ctx.extra.attacker.name}`);
            ctx.extra.attacker.auras.add(effect.id, builtEffect, ctx.character);
        }
        return ctx.extra;
    });
    
    // Apply debuff aura
    processor.register('debuff', (effect, instance, ctx) => {
        const stacks = instance.stacks || effect.stacks || 1;
        const builtEffect = { stacks };
        const target = effect.target || 'target';
        
        let targetChar = null;
        if(target === 'self') {
            targetChar = ctx.character;
        } else if(target === 'attacker' && ctx.extra.attacker) {
            targetChar = ctx.extra.attacker;
        } else if(target === 'target' && ctx.extra.target) {
            targetChar = ctx.extra.target;
        }
        
        if(targetChar && !targetChar.dead) {
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} applies ${effect.id} to ${targetChar.name}`);
            targetChar.auras.add(effect.id, builtEffect, ctx.character);
        }
        return ctx.extra;
    });
    
    // Energy gain
    processor.register('energy', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        ctx.character.energy = Math.min(ctx.character.maxEnergy, ctx.character.energy + amount);
        ctx.character.renderQueue.energy = true;
        return ctx.extra;
    });
    
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
        if (effect.age !== undefined) {
            if (instance.age >= effect.age) {
                instance.remove();
            }
        } else {
            instance.remove();
        }
        return ctx.extra;
    });
    
    // Damage modifiers
    processor.register('increase_damage', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        ctx.extra.amount = (ctx.extra.amount || 0) + amount;
        return ctx.extra;
    });
    
    processor.register('increase_damage_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
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
    
    // Chance-based effects
    processor.register('chance_skip', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(Math.random() * 100 < amount) {
            ctx.extra.skip = true;
            ctx.manager.log.add(`${ctx.character.name} is overcome with ${instance.base.name}!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_dodge', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(Math.random() * 100 < amount) {
            ctx.extra.amount = 0;
            ctx.extra.dodged = true;
            ctx.manager.log.add(`${ctx.character.name} dodges the attack!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_miss', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(Math.random() * 100 < amount) {
            ctx.extra.amount = 0;
            ctx.extra.missed = true;
            ctx.manager.log.add(`${ctx.character.name} misses due to ${instance.base.name}!`);
        }
        return ctx.extra;
    });
    
    processor.register('chance_hit_ally', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(Math.random() * 100 < amount) {
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
    
    processor.register('prevent_death', (effect, instance, ctx) => {
        if(effect.oncePerEncounter && instance._preventDeathUsed) {
            return ctx.extra;
        }
        ctx.extra.prevented = true;
        if(effect.oncePerEncounter) {
            instance._preventDeathUsed = true;
        }
        ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} prevents death!`);
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
        const amount = getEffectAmount(effect, instance);
        const healAmount = Math.ceil((ctx.extra.damageDealt || 0) * (amount / 100));
        if(healAmount > 0) {
            ctx.character.heal({ amount: healAmount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name} heals for ${healAmount} from ${instance.base.name}`);
        }
        return ctx.extra;
    });
    
    // Reflect damage
    processor.register('reflect_damage', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        if(ctx.extra.damageReceived && ctx.extra.attacker) {
            const reflectAmount = Math.ceil(ctx.extra.damageReceived * (amount / 100));
            ctx.extra.attacker.damage({ amount: reflectAmount }, ctx.character);
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} reflects ${reflectAmount} damage`);
        }
        return ctx.extra;
    });
    
    // Cleanse debuffs
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
                ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} cleanses ${removed} debuff(s) from ${target.name}`);
            }
        }
        return ctx.extra;
    });
    
    // Random buffs
    processor.register('random_buffs', (effect, instance, ctx) => {
        const buffPool = [
            'adventuring:might', 'adventuring:fortify', 'adventuring:haste',
            'adventuring:regeneration', 'adventuring:barrier', 'adventuring:focus',
            'adventuring:arcane_power', 'adventuring:stealth'
        ];
        const count = effect.count || 1;
        const stacks = instance.stacks || effect.stacks || 1;
        for(let i = 0; i < count; i++) {
            const buffId = buffPool[Math.floor(Math.random() * buffPool.length)];
            ctx.character.auras.add(buffId, { stacks }, ctx.character);
        }
        ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} grants ${count} random buffs`);
        return ctx.extra;
    });
    
    // Random debuffs
    processor.register('random_debuffs', (effect, instance, ctx) => {
        const debuffPool = [
            'adventuring:weaken', 'adventuring:slow', 'adventuring:blind',
            'adventuring:poison', 'adventuring:burn', 'adventuring:decay',
            'adventuring:vulnerability', 'adventuring:chill'
        ];
        const count = effect.count || 1;
        const stacks = instance.stacks || effect.stacks || 1;
        const target = effect.target === 'attacker' ? ctx.extra.attacker : ctx.extra.target;
        if(target && !target.dead) {
            for(let i = 0; i < count; i++) {
                const debuffId = debuffPool[Math.floor(Math.random() * debuffPool.length)];
                target.auras.add(debuffId, { stacks }, ctx.character);
            }
            ctx.manager.log.add(`${ctx.character.name}'s ${instance.base.name} applies ${count} random debuffs to ${target.name}`);
        }
        return ctx.extra;
    });
    
    // XP and loot bonuses
    processor.register('increase_xp_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
        ctx.extra.amount = (ctx.extra.amount || 0) + increase;
        return ctx.extra;
    });
    
    processor.register('increase_loot_percent', (effect, instance, ctx) => {
        const amount = getEffectAmount(effect, instance);
        const increase = Math.ceil((ctx.extra.amount || 0) * (amount / 100));
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

/**
 * Build a description from effects, with optional template and flavor text.
 * This helper standardizes description generation across items, passives, abilities, etc.
 * 
 * @param {Object} config - Configuration object
 * @param {Array} [config.effects] - Array of effects to describe (flat mode)
 * @param {Array} [config.hits] - Array of hit objects with { target, party, effects[] } (ability mode)
 * @param {Object} config.manager - The adventuring manager (for describeEffectFull)
 * @param {string} [config.template] - Optional description template with placeholders
 * @param {string} [config.flavorText] - Optional flavor text to append
 * @param {Object} [config.stats] - Stats source for scaling calculations
 * @param {string} [config.displayMode] - Display mode: 'total', 'scaled', 'multiplier'
 * @param {boolean} [config.includeTrigger=true] - Whether to include trigger text
 * @param {Function} [config.buildReplacements] - Custom replacement builder function
 * @returns {string} The formatted description
 */
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
    
    // If we have a template, use it with replacements
    if (template !== undefined && template !== null) {
        const source = hits !== undefined ? hits : effects;
        const replacements = buildReplacements 
            ? buildReplacements(source, stats, displayMode)
            : buildEffectReplacements(effects, stats, true);
        desc = parseDescription(template, replacements);
    } 
    // Hits mode - for abilities with multiple hits
    else if (hits !== undefined && hits.length > 0) {
        const hitDescs = [];
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (hit.effects === undefined || hit.effects.length === 0) continue;
            
            const hitEffectDescs = [];
            for (let j = 0; j < hit.effects.length; j++) {
                const effect = hit.effects[j];
                const effectObj = {
                    type: effect.type,
                    trigger: effect.trigger !== undefined ? effect.trigger : 'on_use',
                    value: effect.getAmount !== undefined 
                        ? effect.getAmount(stats, displayMode) 
                        : (effect.amount !== undefined && effect.amount.base !== undefined 
                            ? effect.amount.base 
                            : (effect.amount !== undefined ? effect.amount : (effect.value !== undefined ? effect.value : 0))),
                    stacks: effect.getStacks !== undefined 
                        ? effect.getStacks(stats, displayMode) 
                        : (effect.stacks !== undefined && effect.stacks.base !== undefined 
                            ? effect.stacks.base 
                            : (effect.stacks !== undefined ? effect.stacks : 0)),
                    id: effect.id,
                    target: hit.target,
                    party: hit.party,
                    condition: effect.condition,
                    chance: effect.chance
                };
                hitEffectDescs.push(describeEffectFull(effectObj, manager, { displayMode, includeTrigger: false }));
            }
            if (hitEffectDescs.length > 0) {
                hitDescs.push(hitEffectDescs.join(' and '));
            }
        }
        desc = hitDescs.join('. ');
        if (desc !== '') {
            desc = desc + '.';
        }
    }
    // Flat effects mode
    else if (effects !== undefined && effects.length > 0) {
        const effectDescs = [];
        for (let i = 0; i < effects.length; i++) {
            const effect = effects[i];
            const effectObj = {
                type: effect.type,
                trigger: effect.trigger !== undefined ? effect.trigger : 'passive',
                value: effect.getAmount !== undefined 
                    ? effect.getAmount(stats, displayMode) 
                    : (effect.amount !== undefined && effect.amount.base !== undefined 
                        ? effect.amount.base 
                        : (effect.amount !== undefined ? effect.amount : (effect.value !== undefined ? effect.value : 0))),
                stacks: effect.getStacks !== undefined 
                    ? effect.getStacks(stats, displayMode) 
                    : (effect.stacks !== undefined && effect.stacks.base !== undefined 
                        ? effect.stacks.base 
                        : (effect.stacks !== undefined ? effect.stacks : 0)),
                id: effect.id,
                target: effect.target,
                party: effect.party,
                condition: effect.condition,
                chance: effect.chance
            };
            effectDescs.push(describeEffectFull(effectObj, manager, { displayMode, includeTrigger }));
        }
        desc = effectDescs.join('. ');
        if (desc !== '') {
            desc = desc + '.';
        }
    }
    
    // Append flavor text if present
    if (flavorText !== undefined && flavorText !== null && flavorText !== '') {
        desc = desc !== '' ? `${desc}\n\n${flavorText}` : flavorText;
    }
    
    return desc !== '' ? desc : '';
}

/**
 * Base RenderQueue class for mastery actions with common properties.
 * Provides: name, tooltip, icon, clickable, mastery
 */
class AdventuringMasteryRenderQueue {
    constructor() {
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }

    /**
     * Queue all common properties for re-render
     */
    queueAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
    }
}

/**
 * Extended RenderQueue with newBadge support.
 * Used by entities that can show a "new" badge when first unlocked.
 */
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

/**
 * RenderQueue for equipment items.
 * Adds: upgrade, selected, highlight, equipped
 */
class AdventuringEquipmentRenderQueue extends AdventuringBadgeRenderQueue {
    constructor() {
        super();
        // Override - equipment doesn't use name/clickable/mastery in same way
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
    describeEffects,
    formatTrigger,
    formatTriggerSuffix,
    formatTarget,
    buildEffectReplacements,
    buildHitEffectReplacements,
    buildDescription,
    // Effect processing (unified)
    SimpleEffectInstance,
    getEffectAmount,
    EffectProcessor,
    defaultEffectProcessor,
    addMasteryXPWithBonus,
    // Condition system
    evaluateCondition,
    describeCondition,
    // RenderQueue base classes
    AdventuringMasteryRenderQueue,
    AdventuringBadgeRenderQueue,
    AdventuringEquipmentRenderQueue
}

