const { loadModule } = mod.getContext(import.meta);

const { AdventuringWorkshop } = await loadModule('src/adventuring-workshop.mjs');

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
        this._description = data.description;

        this._media = data.media;

        this.requirements = data.requirements;
        if(data.actions !== undefined)
            this._actions = data.actions;

        //this.idle = new AdventuringBuildingAction(this.manager, this.game, { status: data.idle !== undefined ? data.idle : `Loitering`, requirements: [], effects: [] }, this);

        this.type = data.type;
        if (this.type === "workshop") {
            this.manager.pages.register(data.id, new AdventuringWorkshop(this.manager, this.game, data, this));
            this._page = data.id;
        } else if(this.type === "page" && data.page !== undefined) {
            this._page = data.page;
        }

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.manager.town.setBuilding(this);
        }
        this.renderQueue.clickable = true;
    }

    get active() {
        if(this.page !== undefined) {
            return this.page.active;
        }
        return false;
    }

    get page() {
        return this.manager.pages.byId.get(this._page);
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get description() {
        return this.unlocked ? this._description : "???";
    }

    get media() {
        return this.getMediaURL(this._media);
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
        html += `<div><span>${this.description}</span></div>`;
        html += '</div>'
        return html;
    }

    get action() {
        return `${this.name}`
    }

    availableActions(character) {
        if(this.actions === undefined)
            return [];
        if(this.type === "workshop") {
            let hasOrders = this.page.hasWorkOrders(character);
            if(hasOrders) {
                let work = this.actions.find(action => action.id === "adventuring:work");
                if(work !== undefined)
                    return [work];
            }
            return [];
        } else {
            return this.actions.filter(action => action.canDo(character));
        }
    }

    go() {
        if(this.page !== undefined) {
            this.page.go();
        }
    }

    onLoad() {
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
    }

    postDataRegistration() {
        if(this._actions !== undefined)
            this.actions = this._actions.map(id => this.manager.townActions.getObjectByID(id));
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