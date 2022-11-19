const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringJobDetailsUIComponent } = await loadModule('src/components/adventuring-job-details.mjs');

class AdventuringJobDetailsRenderQueue {
    constructor() {
        this.name = false;
        this.icon = false;
        this.generators = false;
        this.spenders = false;
        this.scaling = false;
    }
}

export class AdventuringJobDetails extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringJobDetailsUIComponent(this.manager, this.game);
        this.renderQueue = new AdventuringJobDetailsRenderQueue();
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    setJob(job) {
        this.job = job;
        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.generators = true;
        this.renderQueue.spenders = true;
        this.renderQueue.scaling = true;
        this.renderQueue.equippable = true;
    }

    postDataRegistration() {

    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderGenerators();
        this.renderSpenders();
        this.renderScaling();
        this.renderEquippable();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.name.textContent = this.job.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.job.media;

        this.renderQueue.icon = false;
    }

    renderGenerators() {
        if(!this.renderQueue.generators)
            return;

        let abilities = this.manager.generators.allObjects.filter(g => g.unlockedBy(this.job));

        this.component.generators.replaceChildren(...abilities.map(ability => {
            ability.renderQueue.description = true;
            ability.renderQueue.name = true;
            ability.render();
            return ability.details.$elements;
        }).flat());

        this.renderQueue.generators = false;
    }

    renderSpenders() {
        if(!this.renderQueue.spenders)
            return;

        let abilities = this.manager.spenders.allObjects.filter(g => g.unlockedBy(this.job));

        this.component.spenders.replaceChildren(...abilities.map(ability => {
            ability.renderQueue.description = true;
            ability.renderQueue.name = true;
            ability.render();
            return ability.details.$elements;
        }).flat());

        this.renderQueue.spenders = false;
    }

    renderScaling() {
        if(!this.renderQueue.scaling)
            return;
        
        Object.entries(this.component.scaling.skills).forEach(([skill, text]) => {
            text.textContent = this.job.levelScaling[skill] || "-";
        });

        this.renderQueue.scaling = false;
    }

    renderEquippable() {
        if(!this.renderQueue.equippable)
            return;
        
        this.component.equippable.children.forEach($el => {
            let [ $title, $valid ] = $el.children;
            let itemSlot = $valid.dataset.slot;
            let typesForSlot = this.manager.itemTypes.filter(type => type.slots.includes(itemSlot));
            let typesFilteredByJob = typesForSlot.filter(type => this.job.allowedItems.includes(type.id));
            $valid.textContent = typesFilteredByJob.map(type => type.name).join(', ');
        });

        this.renderQueue.equippable = false;
    }
}