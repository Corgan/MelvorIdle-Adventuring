const { loadModule } = mod.getContext(import.meta);

const { AdventuringAreaUIComponent } = await loadModule('src/components/adventuring-area.mjs');

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

class AdventuringAreaRenderQueue {
    constructor(){
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }

    queueAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
    }
}

export class AdventuringArea extends MasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = new AdventuringAreaUIComponent(this.manager, this.game, this);
        this.renderQueue = new AdventuringAreaRenderQueue();

        this._name = data.name;

        this._media = data.media;

        this.requirements = data.requirements;

        this.floors = data.floors;

        this.height = data.height;
        this.width = data.width;

        this.tiles = data.tiles;

        this.loot = data.loot;
        
        this.lootPoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
        //this.lootPoolGenerator.loadTable(this.loot.pool);
        
        /*if(this.tiles.treasure.loot) {
            this.treasurePoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
            this.treasurePoolGenerator.loadTable(this.tiles.treasure.loot.pool);
        }*/

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.manager.selectArea(this);
        }
        this.renderQueue.clickable = true;
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    get unlocked() {
        if(this.requirements.length == 0)
            return true;
        return this.requirements.reduce((equipable, requirement) => {
            if(requirement.type == "skill_level") {
                if(this.manager.level < requirement.level)
                    return false;
            }
            return equipable;
        }, true);
    }

    get tooltip() {
        let html = '<div>';

        html += `<div><span>${this.name}</span></div>`;
        if(this.unlocked) {
            let { xp, level, percent, nextLevelXP } = this.manager.getMasteryProgress(this);
            html += `<div><small>${xp} / ${nextLevelXP} XP</small></div>`;
        }
        html += '</div>'
        return html;
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
        this.renderQueue.mastery = true;
    }

    postDataRegistration() {

    }

    addXP(xp) {
        this.manager.addMasteryXP(this, xp);
        this.manager.addMasteryPoolXP(xp);
        this.renderQueue.tooltip = true;
    }

    render() {
        this.renderName();
        this.renderTooltip();
        this.renderIcon();
        this.renderClickable();
        this.renderMastery();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.name.textContent = this.name;
            this.component.level.textContent = ` (${this.level})`;
        } else {
            this.component.name.textContent = "???";
            this.component.level.textContent = "";
        }

        this.renderQueue.name = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.tooltip.setContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.unlocked) {
            this.component.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.svg');
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
}