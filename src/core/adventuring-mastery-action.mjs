/**
 * Base class for mastery actions with effect caching.
 * Extends MasteryAction (Melvor) and adds mastery effects caching.
 * 
 * Subclasses must implement: get masteryCategoryId()
 * 
 * Used by: AdventuringJob, AdventuringMonster, AdventuringArea, AdventuringItemBase
 */
export class AdventuringMasteryAction extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, game);
        this.manager = manager;
        this.game = game;
        
        // Mastery cache state
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }
    
    /**
     * Override in subclass to return the mastery category ID.
     * @returns {string} The mastery category ID (e.g., 'adventuring:job_mastery')
     */
    get masteryCategoryId() {
        throw new Error('Subclass must implement masteryCategoryId getter');
    }
    
    /**
     * Get the mastery category object.
     * @returns {MasteryCategory|undefined}
     */
    get masteryCategory() {
        return this.manager.masteryCategories.getObjectByID(this.masteryCategoryId);
    }
    
    /**
     * Get current mastery effects, with caching based on level.
     * @returns {Array} Array of effect objects
     */
    get masteryEffects() {
        const currentLevel = this.level;
        if (this._masteryEffectsCache === null || this._masteryCacheLevel !== currentLevel) {
            this._rebuildMasteryCache();
        }
        return this._masteryEffectsCache;
    }
    
    /**
     * Rebuild the mastery effects cache.
     * @private
     */
    _rebuildMasteryCache() {
        const category = this.masteryCategory;
        this._masteryCacheLevel = this.level;
        this._masteryEffectsCache = category !== undefined ? category.getEffectsAtLevel(this.level) : [];
    }
    
    /**
     * Invalidate the mastery cache (call when mastery level changes).
     */
    invalidateMasteryCache() {
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }
    
    /**
     * Check if a mastery effect of the given type is active.
     * @param {string} effectType - Effect type to check for
     * @returns {boolean}
     */
    hasMasteryEffect(effectType) {
        return this.masteryEffects.some(e => e.type === effectType);
    }
    
    /**
     * Check if an unlock of the given type is active.
     * @param {string} unlockType - Unlock type to check for (e.g., 'auto_run', 'mastered_variant')
     * @returns {boolean}
     */
    hasUnlock(unlockType) {
        return this.masteryEffects.some(e => e.type === 'unlock' && e.unlockType === unlockType);
    }
    
    /**
     * Get the total value of all mastery effects of a given type.
     * @param {string} effectType - Effect type to sum
     * @returns {number}
     */
    getMasteryEffectValue(effectType) {
        return this.masteryEffects
            .filter(e => e.type === effectType)
            .reduce((sum, e) => sum + (e.value || 0), 0);
    }
}
