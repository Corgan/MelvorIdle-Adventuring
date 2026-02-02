/**
 * Tracks effect trigger limits per combat/round/turn.
 */
export class EffectLimitTracker {
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
