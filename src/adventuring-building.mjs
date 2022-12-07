const { loadModule } = mod.getContext(import.meta);

const { AdventuringBuildingUIComponent } = await loadModule('src/components/adventuring-building.mjs');

class AdventuringBuildingRenderQueue {
    constructor(){
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
    }

    queueAll() {
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
    }
}

export class AdventuringBuilding extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = new AdventuringBuildingUIComponent(this.manager, this.game, this);
        this.renderQueue = new AdventuringBuildingRenderQueue();

        this._name = data.name;

        this._media = data.media;

        this.requirements = data.requirements;

        this.page = data.page;

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.manager.selectBuilding(this);
        }
        this.renderQueue.clickable = true;
    }

    get active() {
        if(this.page !== undefined) {
            let page = this.manager.pages.byId.get(this.page);
            if(page !== undefined)
                return page.active;
        }
        return false;
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get level() {
        return this.manager.town.buildingLevels.get(this);
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
        html += '</div>'
        return html;
    }

    onLoad() {
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
    }

    postDataRegistration() {

    }

    render() {
        this.renderTooltip();
        this.renderIcon();
        this.renderClickable();
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
}