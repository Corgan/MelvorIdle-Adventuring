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
     * Get all effects that are active at the given mastery level.
     * For non-scaling effects with the same type, only the highest level milestone applies.
     * Exception: unlock effects (unlock_difficulty, etc.) accumulate since each unlocks something different.
     * For scaling effects, the value is multiplied by the current level.
     * @param {number} level - Current mastery level
     * @returns {Array} Array of effect objects
     */
    getEffectsAtLevel(level) {
        // Map to track highest-level effect for each type (non-scaling only)
        const effectsByType = new Map();
        const scalingEffects = [];
        const accumulatedEffects = []; // Effects that accumulate (unlock_difficulty, etc.)
        
        for (const milestone of this.milestones) {
            if (level >= milestone.level) {
                if (milestone.effects) {
                    for (const effect of milestone.effects) {
                        if (milestone.scaling && effect.value !== undefined) {
                            // Scaling effects: multiply value by level, add directly
                            scalingEffects.push({
                                ...effect,
                                value: effect.value * level
                            });
                        } else if (effect.type === 'unlock_difficulty') {
                            // Unlock effects accumulate - each unlocks something different
                            accumulatedEffects.push(effect);
                        } else {
                            // Non-scaling: track by type, keep highest level's effect
                            const existing = effectsByType.get(effect.type);
                            if (!existing || milestone.level > existing.milestoneLevel) {
                                effectsByType.set(effect.type, {
                                    effect: effect,
                                    milestoneLevel: milestone.level
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // Combine: all scaling effects + accumulated unlocks + one per type for non-scaling
        const results = [...scalingEffects, ...accumulatedEffects];
        for (const entry of effectsByType.values()) {
            results.push(entry.effect);
        }
        
        return results;
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
