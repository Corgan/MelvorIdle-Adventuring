const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');

/**
 * Base class for effects that have amount/stacks with stat-based scaling.
 * Used by AbilityHitEffect, PassiveEffect, and AuraEffect.
 * 
 * Supports:
 * - Base amount + stat-based scaling
 * - perStack multiplier (amount * instance stacks)
 * - scaleFrom: 'source' | 'target' | 'snapshot' for auras
 */
export class AdventuringScalableEffect {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.type = data.type;
        this.trigger = data.trigger;

        if(data.id !== undefined)
            this.id = data.id;

        if(data.target !== undefined)
            this.target = data.target;

        if(data.party !== undefined)
            this.party = data.party;
        
        // perStack: multiply amount by instance stacks (for auras)
        if(data.perStack !== undefined)
            this.perStack = data.perStack === true;
        
        // scaleFrom: which stats to use for scaling (for auras)
        // 'source' = caster's stats (default), 'target' = aura holder's stats, 'snapshot' = stats at application
        if(data.scaleFrom !== undefined)
            this.scaleFrom = data.scaleFrom;

        if(data.amount !== undefined) {
            this.amount = { base: data.amount.base !== undefined ? data.amount.base : data.amount };
            if(data.amount.scaling !== undefined) {
                this.amount._scaling = data.amount.scaling;
                this.amount.scaling = new AdventuringStats(this.manager, this.game);
            }
        }

        if(data.stacks !== undefined) {
            this.stacks = { base: data.stacks.base !== undefined ? data.stacks.base : data.stacks };
            if(data.stacks.scaling !== undefined) {
                this.stacks._scaling = data.stacks.scaling;
                this.stacks.scaling = new AdventuringStats(this.manager, this.game);
            }
        }
    }

    postDataRegistration() {
        if(this.amount !== undefined && this.amount._scaling !== undefined) {
            this.amount._scaling.forEach(({ id, amount }) => {
                this.amount.scaling.set(id, amount);
            });
            delete this.amount._scaling;
        }
        if(this.stacks !== undefined && this.stacks._scaling !== undefined) {
            this.stacks._scaling.forEach(({ id, amount }) => {
                this.stacks.scaling.set(id, amount);
            });
            delete this.stacks._scaling;
        }
    }

    /**
     * Get stat value from source, using effective stats if available
     * @param {*} source - Character (with getEffectiveStat) or Stats Map
     * @param {*} stat - Stat to get
     */
    _getStatValue(source, stat) {
        // If source has getEffectiveStat (it's a character), use it for aura modifiers
        if(source && typeof source.getEffectiveStat === 'function') {
            return source.getEffectiveStat(stat);
        }
        // Otherwise it's a stats Map, use direct get
        if(source && typeof source.get === 'function') {
            return source.get(stat);
        }
        return 0;
    }

    /**
     * Check if source has stats (for description rendering)
     */
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
     * Get the amount value, with optional display formatting.
     * 
     * Display modes:
     * - 'total': Just the total number (25) - for tooltips
     * - 'scaled': Base + scaled value with icon (5 + 20 icon) - for ability selector
     * - 'multiplier': Base + multiplier with icon (5 + 0.5 icon) - for job overview
     * - false/undefined: Raw calculated number for combat logic
     * 
     * @param {object} source - Stats source (character or stats map)
     * @param {string} displayMode - Display mode: 'total', 'scaled', 'multiplier', or falsy for raw
     * @returns {number|string} Calculated amount or formatted string
     */
    getAmount(source, displayMode) {
        let amount = this.amount !== undefined && this.amount.base !== undefined ? this.amount.base : 0;
        
        // No display mode - return raw number
        if (!displayMode) {
            if(this.amount !== undefined && this.amount.scaling !== undefined && source !== undefined) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(amount);
        }
        
        // Display modes
        const hasScaling = this.amount !== undefined && this.amount.scaling !== undefined && this.amount.scaling.size > 0;
        
        if (!hasScaling) {
            return amount; // No scaling, just return base
        }
        
        if (displayMode === 'total') {
            // Calculate total and return as number
            if (source) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(amount);
        }
        
        // Build formatted string with icons
        let ret = amount;
        for (const [stat, scale] of this.amount.scaling) {
            const statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`;
            
            if (displayMode === 'multiplier') {
                // Show the multiplier itself (0.5)
                ret += ` + ${scale} ${statImg}`;
            } else if (displayMode === 'scaled') {
                // Show calculated value from stats
                const value = source ? Math.floor(this._getStatValue(source, stat) * scale) : scale;
                ret += ` + ${value} ${statImg}`;
            }
        }
        return ret;
    }

    /**
     * Get the stacks value, with optional display formatting.
     * See getAmount for display mode documentation.
     */
    getStacks(source, displayMode) {
        let stacks = this.stacks !== undefined && this.stacks.base !== undefined ? this.stacks.base : 0;
        
        // No display mode - return raw number
        if (!displayMode) {
            if(this.stacks !== undefined && this.stacks.scaling !== undefined && source !== undefined)
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            return Math.floor(stacks);
        }
        
        // Display modes
        const hasScaling = this.stacks !== undefined && this.stacks.scaling !== undefined && this.stacks.scaling.size > 0;
        
        if (!hasScaling) {
            return stacks;
        }
        
        if (displayMode === 'total') {
            if (source) {
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(stacks);
        }
        
        // Build formatted string with icons
        let ret = stacks;
        for (const [stat, scale] of this.stacks.scaling) {
            const statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`;
            
            if (displayMode === 'multiplier') {
                ret += ` + ${scale} ${statImg}`;
            } else if (displayMode === 'scaled') {
                const value = source ? Math.floor(this._getStatValue(source, stat) * scale) : scale;
                ret += ` + ${value} ${statImg}`;
            }
        }
        return ret;
    }
}
