const { loadModule } = mod.getContext(import.meta);

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

const { AdventuringMonsterElement } = await loadModule('src/components/adventuring-monster.mjs');

class AdventuringMonsterRenderQueue {
    constructor(){
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }

    updateAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
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
        return this.manager.bestiary.seen.get(this) === true;
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