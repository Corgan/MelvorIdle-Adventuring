const { loadModule } = mod.getContext(import.meta);

const { AdventuringWeightedTable, addMasteryXPWithBonus } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

const { AdventuringMonsterElement } = await loadModule('src/entities/components/adventuring-monster.mjs');

class AdventuringMonsterRenderQueue {
    constructor(){
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
        this.newBadge = false;
    }

    updateAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
        this.newBadge = true;
    }
}
export class AdventuringMonster extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, game);
        this.manager = manager;
        this.game = game;
        this._name = data.name;
        this._media = data.media;
        this.stats = data.stats;
        this.xp = data.xp;
        this.generator = data.generator;
        this.spender = data.spender;
        this.passives = data.passives;

        this.component = createElement('adventuring-monster');
        this.renderQueue = new AdventuringMonsterRenderQueue();

        this.lootGenerator = new AdventuringWeightedTable(this.manager, this.game);
        this.lootGenerator.loadTable(data.loot);
        
        // Mastery effects cache - rebuilt on level up
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }

    /**
     * Get the mastery category for monsters
     */
    get masteryCategory() {
        return this.manager.masteryCategories.getObjectByID('adventuring:monsters');
    }

    /**
     * Get cached mastery effects for this monster's current level.
     * Rebuilds cache if level changed.
     */
    get masteryEffects() {
        const currentLevel = this.level;
        if (this._masteryEffectsCache === null || this._masteryCacheLevel !== currentLevel) {
            this._rebuildMasteryCache();
        }
        return this._masteryEffectsCache;
    }

    /**
     * Rebuild the mastery effects cache from the category milestones
     */
    _rebuildMasteryCache() {
        const category = this.masteryCategory;
        this._masteryCacheLevel = this.level;
        this._masteryEffectsCache = category ? category.getEffectsAtLevel(this.level) : [];
    }

    /**
     * Invalidate mastery cache (called on level up)
     */
    invalidateMasteryCache() {
        this._masteryEffectsCache = null;
        this._masteryCacheLevel = -1;
    }

    /**
     * Check if this monster has a specific mastery effect type
     * @param {string} effectType - The effect type to check for
     * @returns {boolean}
     */
    hasMasteryEffect(effectType) {
        return this.masteryEffects.some(e => e.type === effectType);
    }

    /**
     * Get the total value of a specific mastery effect type
     * @param {string} effectType - The effect type to sum
     * @returns {number}
     */
    getMasteryEffectValue(effectType) {
        return this.masteryEffects
            .filter(e => e.type === effectType)
            .reduce((sum, e) => sum + (e.value || 0), 0);
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.png');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get unlocked() {
        return this.manager.bestiary.seen.get(this) === true;
    }

    get category() {
        return this.manager.categories.getObjectByID('adventuring:Monsters');
    }

    get tooltip() {
        return TooltipBuilder.forMonster(this, this.manager).build();
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
        this.renderQueue.mastery = true;
        this.renderQueue.newBadge = true;
    }

    postDataRegistration() {

    }

    addXP(xp) {
        addMasteryXPWithBonus(this.manager, this, xp);
    }

    render() {
        this.renderName();
        this.renderTooltip();
        this.renderIcon();
        this.renderClickable();
        this.renderMastery();
        this.renderNewBadge();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.nameText.textContent = this.name;
            this.component.level.textContent = ` (${this.level})`;
        } else {
            this.component.nameText.textContent = "???";
            this.component.level.textContent = "";
        }

        this.renderQueue.name = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.unlocked) {
            this.component.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.png');
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.clickable.classList.toggle('pointer-enabled', this.unlocked);

        this.renderQueue.clickable = false;
    }

    renderMastery() {
        if(!this.renderQueue.mastery)
            return;

        let { xp, level, percent } = this.manager.getMasteryProgress(this);

        if(this.unlocked) {
            this.component.masteryProgress.setFixedPosition(percent);
        } else {
            this.component.masteryProgress.setFixedPosition(0);
        }

        this.renderQueue.mastery = false;
    }

    renderNewBadge() {
        if(!this.renderQueue.newBadge)
            return;

        const isNew = this.manager.bestiary.isNew(this);
        this.component.newBadge.classList.toggle('d-none', !isNew);

        this.renderQueue.newBadge = false;
    }
}