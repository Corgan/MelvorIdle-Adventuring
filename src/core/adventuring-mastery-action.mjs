
export class AdventuringMasteryAction extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, game);
        this.manager = manager;
        this.game = game;
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }

    get masteryCategoryId() {
        throw new Error('Subclass must implement masteryCategoryId getter');
    }

    get masteryCategory() {
        return this.manager.masteryCategories.getObjectByID(this.masteryCategoryId);
    }

    get masteryEffects() {
        const currentLevel = this.level;
        if (this._masteryEffectsCache === null || this._masteryCacheLevel !== currentLevel) {
            this._rebuildMasteryCache();
        }
        return this._masteryEffectsCache;
    }

    _rebuildMasteryCache() {
        const category = this.masteryCategory;
        this._masteryCacheLevel = this.level;
        this._masteryEffectsCache = category !== undefined ? category.getEffectsAtLevel(this.level) : [];
    }

    invalidateMasteryCache() {
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }

    hasMasteryEffect(effectType) {
        return this.masteryEffects.some(e => e.type === effectType);
    }

    hasUnlock(unlockType) {
        return this.masteryEffects.some(e => e.type === 'unlock' && e.unlockType === unlockType);
    }

    getMasteryEffectValue(effectType) {
        return this.masteryEffects
            .filter(e => e.type === effectType)
            .reduce((sum, e) => sum + (e.value ?? e.amount ?? 0), 0);
    }
}
