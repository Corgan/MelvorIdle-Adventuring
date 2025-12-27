const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');

const { AdventuringJobDetailsElement } = await loadModule('src/components/adventuring-job-details.mjs');

class AdventuringJobDetailsRenderQueue {
    constructor() {
        this.name = false;
        this.icon = false;
        this.abilities = false;
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

    /**
     * Get unlock level for an ability (for sorting)
     */
    getUnlockLevel(ability) {
        if(!ability.requirements || ability.requirements.length === 0) return 0;
        const req = ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level');
        return req ? req.level : 0;
    }

    /**
     * Get usable by text for an ability
     */
    getUsableByText(ability) {
        if(!ability.requirements || ability.requirements.length === 0) return 'All';
        const req = ability.requirements.find(r => r.type === 'job_level' || r.type === 'current_job_level');
        if(!req) return 'All';
        if(req.type === 'current_job_level') {
            const job = this.manager.jobs.getObjectByID(req.job);
            return job ? job.name : '???';
        }
        return 'All';
    }

    /**
     * Build tooltip for an ability
     */
    buildAbilityTooltip(ability, type) {
        const tooltip = new TooltipBuilder();
        const isUnlocked = ability.unlocked !== undefined ? ability.unlocked : true;
        
        // Name
        tooltip.header(isUnlocked ? ability.name : '???');
        
        // Type badge
        const typeColors = { generator: 'text-info', spender: 'text-warning', passive: 'text-success' };
        const typeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
        tooltip.info(`<span class="${typeColors[type]}">${typeLabels[type]}</span>`);
        
        // Usable by
        const usableBy = this.getUsableByText(ability);
        tooltip.separator().hint(`Usable by: ${usableBy}`);
        
        // Description with stats
        tooltip.separator();
        if(isUnlocked) {
            tooltip.info(ability.getDescription ? ability.getDescription(undefined, true) : ability.description);
        } else {
            tooltip.warning('???');
        }
        
        // Energy (for generators/spenders) - only show if unlocked
        if(type !== 'passive' && isUnlocked) {
            if(ability.energy !== undefined) {
                tooltip.separator();
                tooltip.bonus(`+${ability.energy} Energy`);
            } else if(ability.cost !== undefined) {
                tooltip.separator();
                tooltip.penalty(`-${ability.cost} Energy`);
            }
        }
        
        // Unlock requirement
        const unlockLevel = this.getUnlockLevel(ability);
        if(unlockLevel > 0) {
            const currentLevel = this.manager.getMasteryLevel(this.job);
            tooltip.separator();
            if(isUnlocked) {
                tooltip.text(`Unlocked at Lv.${unlockLevel}`, 'text-success');
            } else {
                tooltip.warning(`Requires Lv.${unlockLevel} (${currentLevel}/${unlockLevel})`);
            }
        }
        
        return tooltip.build();
    }

    /**
     * Create ability row element
     */
    createAbilityRow(ability, type) {
        const row = document.createElement('div');
        row.className = 'd-flex align-items-center p-2 mb-1 border-bottom border-dark pointer-enabled';
        
        const isUnlocked = ability.unlocked !== undefined ? ability.unlocked : true;
        
        // Status indicator
        const status = document.createElement('span');
        status.className = isUnlocked ? 'text-success mr-2' : 'text-warning mr-2';
        status.textContent = isUnlocked ? '\u2713' : '\u2717';
        row.appendChild(status);
        
        // Name
        const name = document.createElement('span');
        name.className = isUnlocked ? 'font-w600' : 'font-w600 text-muted';
        name.textContent = isUnlocked ? ability.name : '???';
        row.appendChild(name);
        
        // Type badge
        const badge = document.createElement('span');
        const badgeColors = { generator: 'badge-info', spender: 'badge-warning', passive: 'badge-success' };
        const badgeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
        badge.className = `badge ${badgeColors[type]} ml-auto`;
        badge.textContent = badgeLabels[type];
        row.appendChild(badge);
        
        // Unlock level
        const level = document.createElement('small');
        level.className = 'text-muted ml-2';
        level.textContent = `Lv.${this.getUnlockLevel(ability)}`;
        row.appendChild(level);
        
        // Add tooltip
        tippy(row, {
            content: this.buildAbilityTooltip(ability, type),
            allowHTML: true,
            placement: 'right'
        });
        
        // Mark as seen
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
            
            // Collect all abilities for this job
            const generators = this.manager.generators.allObjects
                .filter(g => g.unlockedBy(this.job))
                .map(a => ({ ability: a, type: 'generator' }));
            const spenders = this.manager.spenders.allObjects
                .filter(s => s.unlockedBy(this.job))
                .map(a => ({ ability: a, type: 'spender' }));
            const passives = this.manager.passives.allObjects
                .filter(p => p.unlockedBy(this.job))
                .map(a => ({ ability: a, type: 'passive' }));
            
            // Combine and sort by unlock level
            const allAbilities = [...generators, ...spenders, ...passives]
                .sort((a, b) => this.getUnlockLevel(a.ability) - this.getUnlockLevel(b.ability));
            
            // Create rows
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