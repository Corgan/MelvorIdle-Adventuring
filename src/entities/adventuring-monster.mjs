const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringWeightedTable, addMasteryXPWithBonus, AdventuringBadgeRenderQueue, getLockedMedia, UNKNOWN_MEDIA } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

const { AdventuringMonsterElement } = await loadModule('src/entities/components/adventuring-monster.mjs');

export class AdventuringMonster extends AdventuringMasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
        this._name = data.name;
        this._media = data.media;
        this.stats = data.stats;
        this.xp = data.xp;
        this.generator = data.generator;
        this.spender = data.spender;
        this.passives = data.passives;

        this.component = createElement('adventuring-monster');
        this.renderQueue = new AdventuringBadgeRenderQueue();

        this.lootGenerator = new AdventuringWeightedTable(this.manager, this.game);
        this.lootGenerator.loadTable(data.loot);
    }

    get masteryCategoryId() {
        return 'adventuring:monsters';
    }

    get name() {
        return this._name;
    }

    get media() {
        return getLockedMedia(this);
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

    viewDetails() {
        if(!this.unlocked) return;
        this.manager.monsterdetails.setMonster(this);
        this.manager.monsterdetails.render();
        this.manager.monsterdetails.go();
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
            this.component.icon.src = this.getMediaURL(UNKNOWN_MEDIA);
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.clickable.classList.toggle('pointer-enabled', this.unlocked);
        
        // Add click handler to view details
        this.component.clickable.onclick = () => this.viewDetails();

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