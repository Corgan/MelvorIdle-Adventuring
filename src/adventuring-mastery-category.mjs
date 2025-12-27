/**
 * Represents a mastery category (areas, jobs, monsters, equipment)
 * All objects in a category share the same milestone definitions.
 * Example: All areas get auto-run at mastery 10, endless at 75, etc.
 */
export class AdventuringMasteryCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        
        // Maximum mastery level
        this.maxLevel = data.maxLevel ?? 99;
        
        // Milestones with effects arrays
        // Each milestone: { level, scaling?, effects: [{ trigger, type, value, ... }] }
        this.milestones = data.milestones ?? [];
        
        // Sort milestones by level for efficient lookup
        this.milestones.sort((a, b) => a.level - b.level);
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    /**
     * Get all effects that are active at the given mastery level
     * @param {number} level - Current mastery level
     * @returns {Array} Array of effect objects
     */
    getEffectsAtLevel(level) {
        const effects = [];
        
        for (const milestone of this.milestones) {
            if (level >= milestone.level) {
                if (milestone.effects) {
                    for (const effect of milestone.effects) {
                        // For scaling milestones, multiply value by level
                        if (milestone.scaling && effect.value !== undefined) {
                            effects.push({
                                ...effect,
                                value: effect.value * level
                            });
                        } else {
                            effects.push(effect);
                        }
                    }
                }
            }
        }
        
        return effects;
    }

    /**
     * Get the next milestone after the given level
     * @param {number} level - Current mastery level
     * @returns {Object|null} Next milestone or null if maxed
     */
    getNextMilestone(level) {
        return this.milestones.find(m => m.level > level) ?? null;
    }

    /**
     * Get all milestones achieved at the given level
     * @param {number} level - Current mastery level
     * @returns {Array} Array of achieved milestones
     */
    getAchievedMilestones(level) {
        return this.milestones.filter(m => level >= m.level);
    }
}
