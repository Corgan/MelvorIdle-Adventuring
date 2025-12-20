const { loadModule } = mod.getContext(import.meta);

const { AdventuringMaterialElement } = await loadModule('src/components/adventuring-material.mjs');

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

class AdventuringMaterialRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.count = false;
    }

    updateAll() {
        this.name = true;
        this.icon = true;
        this.count = true;
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
    }

    get name() {
        return this.unlocked ? this._name : "???";
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.svg');
    }

    get count() {
        return this.manager.stash.materialCounts.get(this);
    }

    get unlocked() {
        return this.manager.stash.unlocked.get(this) === true;
    }

    add(qty) {
        this.manager.stash.add(this, qty);
    }

    remove(qty) {
        this.manager.stash.remove(this, qty);
    }

    postDataRegistration() {
        
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
    }

    renderTooltip() {
        if(!this.renderQueue.name)
            return;

        this.component.tooltip.setContent(this.name);

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
}