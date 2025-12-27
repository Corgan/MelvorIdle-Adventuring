const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

/**
 * Base class for effects that have amount/stacks with stat-based scaling.
 * Used by AbilityHitEffect and PassiveEffect.
 */
export class ScalableEffect {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.type = data.type;

        if(data.id !== undefined)
            this.id = data.id;

        if(data.target !== undefined)
            this.target = data.target;

        if(data.party !== undefined)
            this.party = data.party;

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
            this.amount._scaling.forEach(({ id, value }) => {
                this.amount.scaling.set(id, value);
            });
            delete this.amount._scaling;
        }
        if(this.stacks !== undefined && this.stacks._scaling !== undefined) {
            this.stacks._scaling.forEach(({ id, value }) => {
                this.stacks.scaling.set(id, value);
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

    getAmount(source, isDesc=false) {
        let amount = this.amount !== undefined && this.amount.base !== undefined ? this.amount.base : 0;
        if(isDesc) {
            let ret = amount;
            if(this.amount !== undefined && this.amount.scaling !== undefined) {
                let showScale = source === undefined || !this._hasStats(source);
                ret += [...this.amount.scaling].reduce((str, [stat, scale]) => {
                    let value = showScale ? scale : Math.floor(this._getStatValue(source, stat) * scale);
                    let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                    return str + ` + ${value} ${statImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.amount !== undefined && this.amount.scaling !== undefined && source !== undefined) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(amount);
        }
    }

    getStacks(source, isDesc=false) {
        let stacks = this.stacks !== undefined && this.stacks.base !== undefined ? this.stacks.base : 0;
        if(isDesc) {
            let ret = stacks;
            if(this.stacks !== undefined && this.stacks.scaling !== undefined) {
                let showScale = source === undefined || !this._hasStats(source);
                ret += [...this.stacks.scaling].reduce((str, [stat, scale]) => {
                    let value = showScale ? scale : Math.floor(this._getStatValue(source, stat) * scale);
                    let statImg = `<img class="skill-icon-xxs" style="height: .66rem; width: .66rem; margin-top: 0;" src="${stat.media}">`
                    return str + ` + ${value} ${statImg}`;
                }, '');
            }
            return ret;
        } else {
            if(this.stacks !== undefined && this.stacks.scaling !== undefined && source !== undefined)
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            return Math.floor(stacks);
        }
    }
}
