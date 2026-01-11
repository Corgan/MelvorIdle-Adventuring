
export class AdventuringMasteryCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this.maxLevel = (data.maxLevel !== undefined) ? data.maxLevel : 99;
        this.milestones = data.milestones || [];
        this.milestones.sort((a, b) => a.level - b.level);
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    getEffectsAtLevel(level) {
        const accumulatedByType = new Map();
        const scalingEffects = [];
        const unlockEffects = []; // Unlocks collected separately

        for (const milestone of this.milestones) {
            if (level >= milestone.level) {
                if (milestone.effects) {
                    for (const effect of milestone.effects) {
                        if (milestone.scaling && effect.amount !== undefined) {
                            scalingEffects.push({
                                ...effect,
                                amount: effect.amount * level
                            });
                        } else if (effect.type === 'unlock') {
                            unlockEffects.push(effect);
                        } else {
                            const value = effect.value ?? effect.amount ?? 0;
                            const existing = accumulatedByType.get(effect.type) || 0;
                            accumulatedByType.set(effect.type, existing + value);
                        }
                    }
                }
            }
        }
        const results = [...scalingEffects, ...unlockEffects];
        for (const [type, totalValue] of accumulatedByType.entries()) {
            results.push({ type, value: totalValue });
        }

        return results;
    }

    getNextMilestone(level) {
        const found = this.milestones.find(m => m.level > level);
        return found || null;
    }

    getAchievedMilestones(level) {
        return this.milestones.filter(m => level >= m.level);
    }
}
