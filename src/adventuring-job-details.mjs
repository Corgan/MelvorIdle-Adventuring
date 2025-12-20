const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

const { AdventuringJobDetailsElement } = await loadModule('src/components/adventuring-job-details.mjs');

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
        this.component = createElement('adventuring-job-details');

        this.scaling = new AdventuringStats(this.manager, this.game);
        this.scaling.component.mount(this.component.scaling);

        this.renderQueue = new AdventuringJobDetailsRenderQueue();
        this.component.back.onclick = () => this.back();
    }

    back() {
        if(this.active) {
            this.manager.trainer.go();
        }
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

        this.scaling.reset();
        this.job.scaling.forEach((value, stat) => {
            this.scaling.set(stat, value);
        });
        this.scaling.renderQueue.stats = true;

        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.generators = true;
        this.renderQueue.spenders = true;
        this.renderQueue.equipable = true;
    }

    postDataRegistration() {

    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderGenerators();
        this.renderSpenders();
        this.renderEquipable();
        this.scaling.render();
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

        if(this.job.isPassive) {
            this.component.generators.classList.add('d-none');
        } else {
            this.component.generators.classList.remove('d-none');
            let abilities = this.manager.generators.allObjects.filter(g => g.unlockedBy(this.job));

            this.component.generators.replaceChildren(...abilities.map(ability => {
                ability.renderQueue.description = true;
                ability.renderQueue.name = true;
                ability.render();
                return ability.details.$elements;
            }).flat());
        }

        this.renderQueue.generators = false;
    }

    renderSpenders() {
        if(!this.renderQueue.spenders)
            return;

        if(this.job.isPassive) {
            this.component.spenders.classList.add('d-none');
        } else {
            this.component.spenders.classList.remove('d-none');
            let abilities = this.manager.spenders.allObjects.filter(g => g.unlockedBy(this.job));

            this.component.spenders.replaceChildren(...abilities.map(ability => {
                ability.renderQueue.description = true;
                ability.renderQueue.name = true;
                ability.render();
                return ability.details.$elements;
            }).flat());
        }

        this.renderQueue.spenders = false;
    }

    renderEquipable() {
        if(!this.renderQueue.equipable)
            return;
        if(this.job.isPassive) {
            this.component.equipable.classList.add('d-none');
        } else {
            this.component.equipable.classList.remove('d-none');
            this.component.equipable.children.forEach($el => {
                let [ $title, $valid ] = $el.children;
                let itemSlot = $valid.dataset.slot;
                let typesForSlot = this.manager.itemTypes.filter(type => type.slots.includes(itemSlot));
                let typesFilteredByJob = typesForSlot.filter(type => this.job.allowedItems !== undefined && this.job.allowedItems.includes(type));
                $valid.textContent = typesFilteredByJob.map(type => type.name).join(', ');
            });
        }

        this.renderQueue.equipable = false;
    }
}