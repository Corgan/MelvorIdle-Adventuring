const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/stats/adventuring-stats.mjs');

/**
 * Valid scaleFrom values for resolving the source of scaling properties.
 * 
 * Entity sources (resolve to a character/entity):
 * - 'source': The character applying the effect (default for auras)
 * - 'target': The character receiving the effect
 * - 'snapshot': Stats captured when aura was applied
 * - 'self': The character that owns this effect (for passive effects)
 * 
 * Object sources (resolve to job/item with level/upgradeLevel):
 * - 'combatJob': The character's combat job (has .level)
 * - 'passiveJob': The character's passive job (has .level)
 * - 'item': The item providing this effect (has .upgradeLevel, .masteryLevel)
 */
const SCALE_FROM_VALUES = ['source', 'target', 'snapshot', 'self', 'combatJob', 'passiveJob', 'item'];

/**
 * Property names that can be used for scaling (beyond stat IDs).
 * These are looked up directly on the source object.
 */
const SCALABLE_PROPERTIES = ['level', 'upgradeLevel', 'masteryLevel'];

/**
 * Valid scaleFrom types for individual scaling entries.
 * - 'stat': Scale from character stat (default, existing behavior)
 * - 'buff': Scale from buff stacks on a character
 * - 'debuff': Scale from debuff stacks on a character
 * - 'resource': Scale from HP/energy resources
 */
const SCALE_FROM_TYPES = ['stat', 'buff', 'debuff', 'resource'];

/**
 * Valid resource scaling IDs.
 * - 'hp_current_percent': Current HP as percentage (0-100)
 * - 'hp_missing_percent': Missing HP as percentage (0-100)
 * - 'hp_current': Current HP value
 * - 'hp_max': Max HP value
 * - 'energy_current': Current energy value
 */
const RESOURCE_IDS = ['hp_current_percent', 'hp_missing_percent', 'hp_current', 'hp_max', 'energy_current'];

/**
 * Valid scaleTarget values for aura scaling.
 * - 'caster': The character using the ability (default for stat/buff)
 * - 'target': The target of the ability (default for debuff)
 */
const SCALE_TARGET_VALUES = ['caster', 'target'];

export class AdventuringScalableEffect {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.type = data.type;
        this.trigger = data.trigger;
        this.describe = data.describe !== undefined ? data.describe : true;

        if(data.id !== undefined)
            this.id = data.id;

        if(data.target !== undefined)
            this.target = data.target;

        if(data.party !== undefined)
            this.party = data.party;

        if(data.stat !== undefined)
            this.stat = data.stat;

        if(data.perStack !== undefined)
            this.perStack = data.perStack === true;

        if(data.scaleFrom !== undefined)
            this.scaleFrom = data.scaleFrom;

        if(data.amount !== undefined) {
            // Handle amount as either a number or an object with base/scaling
            if (typeof data.amount === 'number') {
                this.amount = { base: data.amount };
            } else {
                // Object format: { base?, scaling? } - base defaults to 0
                this.amount = { base: data.amount.base ?? 0 };
                if(data.amount.scaling !== undefined) {
                    // Separate stat scaling from aura scaling and resource scaling
                    const statScaling = [];
                    const auraScaling = [];
                    const resourceScaling = [];
                    
                    for (const s of data.amount.scaling) {
                        if (s.scaleFrom === 'buff' || s.scaleFrom === 'debuff') {
                            auraScaling.push(s);
                        } else if (s.scaleFrom === 'resource') {
                            resourceScaling.push(s);
                        } else {
                            statScaling.push(s);
                        }
                    }
                    
                    if (statScaling.length > 0) {
                        this.amount._scaling = statScaling;
                        this.amount.scaling = new AdventuringStats(this.manager, this.game);
                        // Track if we have property-based scaling (level, upgradeLevel, etc.)
                        this.amount._hasPropertyScaling = statScaling.some(
                            s => SCALABLE_PROPERTIES.includes(s.id)
                        );
                    }
                    
                    if (auraScaling.length > 0) {
                        this.amount._auraScaling = auraScaling;
                    }
                    
                    if (resourceScaling.length > 0) {
                        this.amount._resourceScaling = resourceScaling;
                    }
                }
            }
        }

        if(data.stacks !== undefined) {
            // Handle stacks as either a number or an object with base/scaling
            if (typeof data.stacks === 'number') {
                this.stacks = { base: data.stacks };
            } else {
                // Object format: { base?, scaling? } - base defaults to 0
                this.stacks = { base: data.stacks.base ?? 0 };
                if(data.stacks.scaling !== undefined) {
                    // Separate stat scaling from aura scaling and resource scaling
                    const statScaling = [];
                    const auraScaling = [];
                    const resourceScaling = [];
                    
                    for (const s of data.stacks.scaling) {
                        if (s.scaleFrom === 'buff' || s.scaleFrom === 'debuff') {
                            auraScaling.push(s);
                        } else if (s.scaleFrom === 'resource') {
                            resourceScaling.push(s);
                        } else {
                            statScaling.push(s);
                        }
                    }
                    
                    if (statScaling.length > 0) {
                        this.stacks._scaling = statScaling;
                        this.stacks.scaling = new AdventuringStats(this.manager, this.game);
                        this.stacks._hasPropertyScaling = statScaling.some(
                            s => SCALABLE_PROPERTIES.includes(s.id)
                        );
                    }
                    
                    if (auraScaling.length > 0) {
                        this.stacks._auraScaling = auraScaling;
                    }
                    
                    if (resourceScaling.length > 0) {
                        this.stacks._resourceScaling = resourceScaling;
                    }
                }
            }
        }
    }

    postDataRegistration() {
        if(this.amount !== undefined && this.amount._scaling !== undefined) {
            this.amount._scaling.forEach(({ id, amount }) => {
                // Property-based scaling (level, upgradeLevel) stored separately
                if (SCALABLE_PROPERTIES.includes(id)) {
                    if (!this.amount.propertyScaling) {
                        this.amount.propertyScaling = new Map();
                    }
                    this.amount.propertyScaling.set(id, amount);
                } else {
                    // Stat-based scaling
                    this.amount.scaling.set(id, amount);
                }
            });
            delete this.amount._scaling;
        }
        
        // Process aura scaling for amount
        if (this.amount !== undefined && this.amount._auraScaling !== undefined) {
            this.amount.auraScaling = this.amount._auraScaling.map(s => ({
                id: s.id,
                scaleFrom: s.scaleFrom,
                scaleTarget: s.scaleTarget || (s.scaleFrom === 'debuff' ? 'target' : 'caster'),
                amount: s.amount,
                consume: s.consume === true
            }));
            delete this.amount._auraScaling;
        }
        
        // Process resource scaling for amount
        if (this.amount !== undefined && this.amount._resourceScaling !== undefined) {
            this.amount.resourceScaling = this.amount._resourceScaling.map(s => ({
                id: s.id,
                scaleTarget: s.scaleTarget || 'caster',
                amount: s.amount
            }));
            delete this.amount._resourceScaling;
        }
        
        if(this.stacks !== undefined && this.stacks._scaling !== undefined) {
            this.stacks._scaling.forEach(({ id, amount }) => {
                if (SCALABLE_PROPERTIES.includes(id)) {
                    if (!this.stacks.propertyScaling) {
                        this.stacks.propertyScaling = new Map();
                    }
                    this.stacks.propertyScaling.set(id, amount);
                } else {
                    this.stacks.scaling.set(id, amount);
                }
            });
            delete this.stacks._scaling;
        }
        
        // Process aura scaling for stacks
        if (this.stacks !== undefined && this.stacks._auraScaling !== undefined) {
            this.stacks.auraScaling = this.stacks._auraScaling.map(s => ({
                id: s.id,
                scaleFrom: s.scaleFrom,
                scaleTarget: s.scaleTarget || (s.scaleFrom === 'debuff' ? 'target' : 'caster'),
                amount: s.amount,
                consume: s.consume === true
            }));
            delete this.stacks._auraScaling;
        }
        
        // Process resource scaling for stacks
        if (this.stacks !== undefined && this.stacks._resourceScaling !== undefined) {
            this.stacks.resourceScaling = this.stacks._resourceScaling.map(s => ({
                id: s.id,
                scaleTarget: s.scaleTarget || 'caster',
                amount: s.amount
            }));
            delete this.stacks._resourceScaling;
        }
    }

    /**
     * Get a property value from a source object.
     * @param {Object} source - The source object (job, item, character)
     * @param {string} property - Property name ('level', 'upgradeLevel', etc.)
     * @returns {number} The property value
     */
    _getPropertyValue(source, property) {
        if (!source) return 0;
        
        // Direct property access
        if (source[property] !== undefined) {
            return source[property];
        }
        
        // Some objects use getter methods
        const getterName = `get${property.charAt(0).toUpperCase()}${property.slice(1)}`;
        if (typeof source[getterName] === 'function') {
            return source[getterName]();
        }
        
        return 0;
    }

    _getStatValue(source, stat) {
        // If source is a character with getEffectiveStat, use it directly
        if(source && typeof source.getEffectiveStat === 'function') {
            return source.getEffectiveStat(stat);
        }

        // If source is an AdventuringStats with an owner (character), use owner's effective stat
        if(source && source.owner && typeof source.owner.getEffectiveStat === 'function') {
            return source.owner.getEffectiveStat(stat);
        }

        // Fallback to raw value from stats map
        if(source && typeof source.get === 'function') {
            return source.get(stat);
        }
        return 0;
    }

    _hasStats(source) {
        if(source && typeof source.stats !== 'undefined') {
            return source.stats.size > 0;
        }
        if(source && typeof source.size !== 'undefined') {
            return source.size > 0;
        }
        return false;
    }

    /**
     * Resolve the scaling source based on scaleFrom value and context.
     * @param {Object} context - Context with character, combatJob, passiveJob, item
     * @returns {Object} The source object to use for scaling
     */
    resolveScaleSource(context) {
        if (!context) return null;
        
        const scaleFrom = this.scaleFrom || 'self';
        
        switch (scaleFrom) {
            case 'source':
                return context.source || context.character;
            case 'target':
                return context.target;
            case 'self':
                return context.character;
            case 'snapshot':
                return context.snapshotStats;
            case 'combatJob':
                return context.character?.combatJob || context.combatJob;
            case 'passiveJob':
                return context.character?.passiveJob || context.passiveJob;
            case 'equipment':
                return this.sourceItem;
            default:
                return context.character;
        }
    }

    /**
     * Calculate property-based scaling bonus.
     * @param {Map} propertyScaling - Map of property name to scale factor
     * @param {Object} source - Source object with properties
     * @returns {number} Total property scaling bonus
     */
    _calculatePropertyScaling(propertyScaling, source) {
        if (!propertyScaling || !source) return 0;
        
        let bonus = 0;
        for (const [property, scale] of propertyScaling) {
            bonus += this._getPropertyValue(source, property) * scale;
        }
        return bonus;
    }

    /**
     * Get aura stack count from a character.
     * @param {Object} character - The character to check
     * @param {string} auraId - The full namespaced aura ID (e.g., 'adventuring:bleed')
     * @returns {number} The stack count, or 0 if not found
     */
    _getAuraStacks(character, auraId) {
        if (!character || !character.auras) return 0;
        
        const auraInstance = character.auras.get(auraId);
        if (!auraInstance) return 0;
        
        return typeof auraInstance.stacks === 'number' ? auraInstance.stacks : 1;
    }

    /**
     * Remove aura stacks from a character.
     * @param {Object} character - The character to modify
     * @param {string} auraId - The full namespaced aura ID
     * @param {number} count - Number of stacks to remove (or all if undefined)
     */
    _consumeAuraStacks(character, auraId, count) {
        if (!character || !character.auras) return;
        
        const auraInstance = character.auras.get(auraId);
        if (!auraInstance) return;
        
        if (count === undefined) {
            auraInstance.remove();
        } else {
            auraInstance.remove_stacks(count);
        }
    }

    /**
     * Calculate aura-based scaling bonus and track consumes.
     * @param {Array} auraScaling - Array of aura scaling definitions
     * @param {Object} context - Context with caster and target
     * @returns {{ bonus: number, consumes: Array }} Total bonus and pending consume operations
     */
    _calculateAuraScaling(auraScaling, context) {
        if (!auraScaling || !context) return { bonus: 0, consumes: [] };
        
        let bonus = 0;
        const consumes = [];
        
        for (const scaling of auraScaling) {
            const character = scaling.scaleTarget === 'target' ? context.target : context.character;
            const stacks = this._getAuraStacks(character, scaling.id);
            bonus += stacks * scaling.amount;
            
            if (scaling.consume && stacks > 0) {
                consumes.push({
                    character,
                    auraId: scaling.id,
                    stacks
                });
            }
        }
        
        return { bonus, consumes };
    }

    /**
     * Apply pending consume operations.
     * @param {Array} consumes - Array of consume operations from _calculateAuraScaling
     */
    applyConsumes(consumes) {
        if (!consumes) return;
        
        for (const { character, auraId, stacks } of consumes) {
            this._consumeAuraStacks(character, auraId, stacks);
        }
    }

    /**
     * Get a resource value from a character.
     * @param {Object} character - The character to read from
     * @param {string} resourceId - One of RESOURCE_IDS (e.g., 'hp_missing_percent')
     * @returns {number} The resource value
     */
    _getResourceValue(character, resourceId) {
        if (!character) return 0;
        
        const maxHP = character.maxHitpoints || character.hitpoints || 0;
        const currentHP = character.hitpoints || 0;
        
        switch (resourceId) {
            case 'hp_current':
                return currentHP;
            case 'hp_max':
                return maxHP;
            case 'hp_current_percent':
                return maxHP > 0 ? (currentHP / maxHP) * 100 : 0;
            case 'hp_missing_percent':
                return maxHP > 0 ? ((maxHP - currentHP) / maxHP) * 100 : 0;
            case 'energy_current':
                return character.energy || character.currentEnergy || 0;
            default:
                return 0;
        }
    }

    /**
     * Calculate resource-based scaling bonus.
     * @param {Array} resourceScaling - Array of resource scaling definitions
     * @param {Object} context - Context with caster and target
     * @returns {number} Total resource scaling bonus
     */
    _calculateResourceScaling(resourceScaling, context) {
        if (!resourceScaling || !context) return 0;
        
        let bonus = 0;
        
        for (const scaling of resourceScaling) {
            const character = scaling.scaleTarget === 'target' ? context.target : context.character;
            const resourceValue = this._getResourceValue(character, scaling.id);
            bonus += resourceValue * scaling.amount;
        }
        
        return bonus;
    }

    getAmount(source, displayMode, context = null) {
        let amount = this.amount !== undefined && this.amount.base !== undefined ? this.amount.base : 0;
        let pendingConsumes = [];

        if (!displayMode) {
            // Add stat-based scaling
            if(this.amount !== undefined && this.amount.scaling !== undefined && source !== undefined) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            // Add property-based scaling (level, upgradeLevel, etc.)
            if (this.amount !== undefined && this.amount.propertyScaling) {
                const propSource = context ? this.resolveScaleSource(context) : source;
                amount += this._calculatePropertyScaling(this.amount.propertyScaling, propSource);
            }
            // Add aura-based scaling (buff/debuff stacks)
            if (this.amount !== undefined && this.amount.auraScaling && context) {
                const { bonus, consumes } = this._calculateAuraScaling(this.amount.auraScaling, context);
                amount += bonus;
                pendingConsumes = consumes;
            }
            // Add resource-based scaling (HP/energy)
            if (this.amount !== undefined && this.amount.resourceScaling && context) {
                amount += this._calculateResourceScaling(this.amount.resourceScaling, context);
            }
            
            // If we have consumes, return an object with both values
            if (pendingConsumes.length > 0) {
                return { value: Math.floor(amount), consumes: pendingConsumes };
            }
            return Math.floor(amount);
        }

        const hasStatScaling = this.amount !== undefined && this.amount.scaling !== undefined && this.amount.scaling.size > 0;
        const hasPropScaling = this.amount !== undefined && this.amount.propertyScaling && this.amount.propertyScaling.size > 0;
        const hasAuraScaling = this.amount !== undefined && this.amount.auraScaling && this.amount.auraScaling.length > 0;
        const hasResourceScaling = this.amount !== undefined && this.amount.resourceScaling && this.amount.resourceScaling.length > 0;

        if (!hasStatScaling && !hasPropScaling && !hasAuraScaling && !hasResourceScaling) {
            return amount; // No scaling, just return base
        }

        if (displayMode === 'total') {
            if (source) {
                amount += [...(this.amount.scaling || [])].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            if (this.amount.propertyScaling) {
                const propSource = context ? this.resolveScaleSource(context) : source;
                amount += this._calculatePropertyScaling(this.amount.propertyScaling, propSource);
            }
            if (this.amount.auraScaling && context) {
                const { bonus } = this._calculateAuraScaling(this.amount.auraScaling, context);
                amount += bonus;
            }
            if (this.amount.resourceScaling && context) {
                amount += this._calculateResourceScaling(this.amount.resourceScaling, context);
            }
            return Math.floor(amount);
        }

        let ret = amount;
        
        // Stat-based scaling display
        if (this.amount.scaling) {
            for (const [stat, scale] of this.amount.scaling) {
                const statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`;

                if (displayMode === 'multiplier') {
                    ret += ` + ${scale} ${statImg}`;
                } else if (displayMode === 'scaled') {
                    const value = source ? Math.floor(this._getStatValue(source, stat) * scale) : scale;
                    ret += ` + ${value} ${statImg}`;
                }
            }
        }
        
        // Property-based scaling display
        if (this.amount.propertyScaling) {
            for (const [property, scale] of this.amount.propertyScaling) {
                if (displayMode === 'multiplier') {
                    ret += ` + ${scale}/Lv`;
                } else if (displayMode === 'scaled') {
                    const propSource = context ? this.resolveScaleSource(context) : source;
                    const value = propSource ? Math.floor(this._getPropertyValue(propSource, property) * scale) : scale;
                    ret += ` + ${value}`;
                }
            }
        }
        
        // Aura-based scaling display
        if (this.amount.auraScaling) {
            for (const scaling of this.amount.auraScaling) {
                const auraName = scaling.id.split(':')[1] || scaling.id;
                const consumeText = scaling.consume ? ' (consumed)' : '';
                
                if (displayMode === 'multiplier') {
                    ret += ` + ${scaling.amount}/${auraName}${consumeText}`;
                } else if (displayMode === 'scaled' && context) {
                    const character = scaling.scaleTarget === 'target' ? context.target : context.character;
                    const stacks = this._getAuraStacks(character, scaling.id);
                    const value = Math.floor(stacks * scaling.amount);
                    ret += ` + ${value} (${stacks} ${auraName})${consumeText}`;
                }
            }
        }
        
        return ret;
    }

    getStacks(source, displayMode, context = null) {
        let stacks = this.stacks !== undefined && this.stacks.base !== undefined ? this.stacks.base : 0;
        let pendingConsumes = [];

        if (!displayMode) {
            // Add stat-based scaling
            if(this.stacks !== undefined && this.stacks.scaling !== undefined && source !== undefined) {
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            // Add property-based scaling
            if (this.stacks !== undefined && this.stacks.propertyScaling) {
                const propSource = context ? this.resolveScaleSource(context) : source;
                stacks += this._calculatePropertyScaling(this.stacks.propertyScaling, propSource);
            }
            // Add aura-based scaling (buff/debuff stacks)
            if (this.stacks !== undefined && this.stacks.auraScaling && context) {
                const { bonus, consumes } = this._calculateAuraScaling(this.stacks.auraScaling, context);
                stacks += bonus;
                pendingConsumes = consumes;
            }
            // Add resource-based scaling (HP/energy)
            if (this.stacks !== undefined && this.stacks.resourceScaling && context) {
                stacks += this._calculateResourceScaling(this.stacks.resourceScaling, context);
            }
            
            // If we have consumes, return an object with both values
            if (pendingConsumes.length > 0) {
                return { value: Math.floor(stacks), consumes: pendingConsumes };
            }
            return Math.floor(stacks);
        }

        const hasStatScaling = this.stacks !== undefined && this.stacks.scaling !== undefined && this.stacks.scaling.size > 0;
        const hasPropScaling = this.stacks !== undefined && this.stacks.propertyScaling && this.stacks.propertyScaling.size > 0;
        const hasAuraScaling = this.stacks !== undefined && this.stacks.auraScaling && this.stacks.auraScaling.length > 0;
        const hasResourceScaling = this.stacks !== undefined && this.stacks.resourceScaling && this.stacks.resourceScaling.length > 0;

        if (!hasStatScaling && !hasPropScaling && !hasAuraScaling && !hasResourceScaling) {
            return stacks;
        }

        if (displayMode === 'total') {
            if (source) {
                stacks += [...(this.stacks.scaling || [])].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            if (this.stacks.propertyScaling) {
                const propSource = context ? this.resolveScaleSource(context) : source;
                stacks += this._calculatePropertyScaling(this.stacks.propertyScaling, propSource);
            }
            if (this.stacks.auraScaling && context) {
                const { bonus } = this._calculateAuraScaling(this.stacks.auraScaling, context);
                stacks += bonus;
            }
            if (this.stacks.resourceScaling && context) {
                stacks += this._calculateResourceScaling(this.stacks.resourceScaling, context);
            }
            return Math.floor(stacks);
        }

        let ret = stacks;
        
        // Stat-based scaling display
        if (this.stacks.scaling) {
            for (const [stat, scale] of this.stacks.scaling) {
                const statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`;

                if (displayMode === 'multiplier') {
                    ret += ` + ${scale} ${statImg}`;
                } else if (displayMode === 'scaled') {
                    const value = source ? Math.floor(this._getStatValue(source, stat) * scale) : scale;
                    ret += ` + ${value} ${statImg}`;
                }
            }
        }
        
        // Property-based scaling display
        if (this.stacks.propertyScaling) {
            for (const [property, scale] of this.stacks.propertyScaling) {
                if (displayMode === 'multiplier') {
                    ret += ` + ${scale}/Lv`;
                } else if (displayMode === 'scaled') {
                    const propSource = context ? this.resolveScaleSource(context) : source;
                    const value = propSource ? Math.floor(this._getPropertyValue(propSource, property) * scale) : scale;
                    ret += ` + ${value}`;
                }
            }
        }
        
        // Aura-based scaling display
        if (this.stacks.auraScaling) {
            for (const scaling of this.stacks.auraScaling) {
                const auraName = scaling.id.split(':')[1] || scaling.id;
                const consumeText = scaling.consume ? ' (consumed)' : '';
                
                if (displayMode === 'multiplier') {
                    ret += ` + ${scaling.amount}/${auraName}${consumeText}`;
                } else if (displayMode === 'scaled' && context) {
                    const character = scaling.scaleTarget === 'target' ? context.target : context.character;
                    const stacks = this._getAuraStacks(character, scaling.id);
                    const value = Math.floor(stacks * scaling.amount);
                    ret += ` + ${value} (${stacks} ${auraName})${consumeText}`;
                }
            }
        }
        
        return ret;
    }
}

// Export constants for use by other modules
export { SCALE_FROM_VALUES, SCALABLE_PROPERTIES, SCALE_FROM_TYPES, SCALE_TARGET_VALUES };
