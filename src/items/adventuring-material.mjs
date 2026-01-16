const { loadModule } = mod.getContext(import.meta);

const { AdventuringMaterialElement } = await loadModule('src/items/components/adventuring-material.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

const { AdventuringWeightedTable, getLockedMedia } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringMaterialRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.count = false;
        this.newBadge = false;
    }

    queueAll() {
        this.name = true;
        this.icon = true;
        this.count = true;
        this.newBadge = true;
    }

    updateAll() {
        this.queueAll();
    }
}

export class AdventuringMaterial extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = createElement('adventuring-material');
        this.renderQueue = new AdventuringMaterialRenderQueue();

        this._name = data.name;
        this._media = data.media;
        this.isCurrency = data.isCurrency === true;
        this.alwaysUnlocked = data.alwaysUnlocked === true;
        this._categoryID = data.category; // Store raw ID for postDataRegistration lookup
        this.tier = data.tier; // Optional tier (1=crude, 2=refined, 3=immaculate, 4=transcendent)
    }

    get name() {
        return this._name;
    }

    get media() {
        return getLockedMedia(this);
    }

    get count() {
        return this.manager.stash.materialCounts.get(this);
    }

    get unlocked() {
        return this.alwaysUnlocked || this.manager.stash.unlocked.get(this) === true;
    }

    add(qty) {
        this.manager.stash.add(this, qty);
    }

    remove(qty) {
        this.manager.stash.remove(this, qty);
    }

    postDataRegistration() {
        if (this._categoryID) {
            this.category = this.manager.materialCategories.getObjectByID(this._categoryID);
            if (!this.category) {
                console.warn(`Material ${this.id} has unknown category: ${this._categoryID}`);
            }
        }

        this.manager.stash.registerMaterial(this);
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.count = true;
    }

    render() {
        this.renderTooltip();
        this.renderIcon();
        this.renderCount();
        this.renderNewBadge();
    }

    get tooltip() {
        if(this.unlocked) {
            return TooltipBuilder.forMaterial(this, this.manager).build();
        }
        return TooltipBuilder.create().header(this.name, this.media).build();
    }

    renderTooltip() {
        if(!this.renderQueue.name)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.media;

        this.renderQueue.icon = false;
    }

    renderCount() {
        if(!this.renderQueue.count)
            return;

        this.component.count.classList.toggle('d-none', !this.unlocked);
        this.component.count.textContent = this.count;

        this.renderQueue.count = false;
    }

    renderNewBadge() {
        if(!this.renderQueue.newBadge)
            return;

        let isNew = this.unlocked && !this.manager.stash.seenMaterials.has(this.id);
        if(this.component.newBadge !== undefined)
            this.component.newBadge.classList.toggle('d-none', !isNew);

        this.renderQueue.newBadge = false;
    }
}