const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringAbilityRowElement } = await loadModule('src/progression/components/adventuring-ability-row.mjs');
await loadModule('src/progression/components/adventuring-job-details.mjs');

class AdventuringJobDetailsRenderQueue {
    constructor() {
        this.name = false;
        this.icon = false;
        this.abilities = false;
        this.scaling = false;
    }
    queueAll() {
        this.name = true;
        this.icon = true;
        this.abilities = true;
        this.scaling = true;
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

        this.abilityTooltips = [];
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
        this.manager.party.setAllLocked(false);
    }

    onHide() {
        this.manager.party.setAllLocked(true);
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
        this.renderQueue.abilities = true;
        this.renderQueue.equipable = true;
    }

    postDataRegistration() {

    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderAbilities();
        this.renderEquipable();
        this.scaling.render();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.nameText.textContent = this.job.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.job.media;

        this.renderQueue.icon = false;
    }

    getUnlockLevel(ability) {
        if(!ability.requirements || ability.requirements.length === 0) return 0;
        const req = ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level');
        return req ? req.level : 0;
    }

    buildAbilityTooltip(ability, type) {
        return TooltipBuilder.forAbility(ability, {
            manager: this.manager,
            type,
            showUnlockLevel: true,
            masteryAction: this.job,
            displayMode: 'multiplier'
        }).build();
    }

    createAbilityRow(ability, type) {
        const isUnlocked = ability.unlocked !== undefined ? ability.unlocked : true;
        const unlockLevel = this.getUnlockLevel(ability);

        const row = new AdventuringAbilityRowElement();
        row.setAbility({
            name: ability.name,
            isUnlocked,
            type,
            unlockLevel,
            tooltipContent: this.buildAbilityTooltip(ability, type)
        });
        if(isUnlocked && ability.id) {
            this.manager.seenAbilities.add(ability.id);
        }

        return row;
    }

    renderAbilities() {
        if(!this.renderQueue.abilities)
            return;

        if(this.job.isPassive) {
            this.component.abilitiesSection.classList.add('d-none');
        } else {
            this.component.abilitiesSection.classList.remove('d-none');
            const generators = this.manager.generators.allObjects
                .filter(g => g.unlockedBy(this.job))
                .map(a => ({ ability: a, type: 'generator' }));
            const spenders = this.manager.spenders.allObjects
                .filter(s => s.unlockedBy(this.job))
                .map(a => ({ ability: a, type: 'spender' }));
            const passives = this.manager.getPassivesForJob(this.job)
                .map(a => ({ ability: a, type: 'passive' }));
            const allAbilities = [...generators, ...spenders, ...passives]
                .sort((a, b) => this.getUnlockLevel(a.ability) - this.getUnlockLevel(b.ability));
            const rows = allAbilities.map(({ ability, type }) => this.createAbilityRow(ability, type));

            this.component.abilitiesList.replaceChildren(...rows);
        }

        this.renderQueue.abilities = false;
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