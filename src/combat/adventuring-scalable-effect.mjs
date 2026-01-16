const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');

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

    _getStatValue(source, stat) {

        if(source && typeof source.getEffectiveStat === 'function') {
            return source.getEffectiveStat(stat);
        }

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

    getAmount(source, displayMode) {
        let amount = this.amount !== undefined && this.amount.base !== undefined ? this.amount.base : 0;

        if (!displayMode) {
            if(this.amount !== undefined && this.amount.scaling !== undefined && source !== undefined) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(amount);
        }

        const hasScaling = this.amount !== undefined && this.amount.scaling !== undefined && this.amount.scaling.size > 0;

        if (!hasScaling) {
            return amount; // No scaling, just return base
        }

        if (displayMode === 'total') {

            if (source) {
                amount += [...this.amount.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            }
            return Math.floor(amount);
        }

        let ret = amount;
        for (const [stat, scale] of this.amount.scaling) {
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

    getStacks(source, displayMode) {
        let stacks = this.stacks !== undefined && this.stacks.base !== undefined ? this.stacks.base : 0;

        if (!displayMode) {
            if(this.stacks !== undefined && this.stacks.scaling !== undefined && source !== undefined)
                stacks += [...this.stacks.scaling].reduce((bonus, [stat, scale]) => {
                    return bonus + (this._getStatValue(source, stat) * scale)
                }, 0);
            return Math.floor(stacks);
        }

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
