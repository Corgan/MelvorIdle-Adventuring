const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/adventuring-character.mjs');
const { AdventuringEquipment } = await loadModule('src/adventuring-equipment.mjs');
const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');
const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');

class AdventuringHeroRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
        this.jobs = false;
        this.passiveAbilities = false;
    }

    updateAll() {
        super.updateAll();
        this.jobs = true;
        this.passiveAbilities = true;
    }
}

export class AdventuringHero extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);

        this.locked = false;
        this.equipment = new AdventuringEquipment(this.manager, this.game, this);

        this.component.equipment.classList.remove('d-none');
        this.equipment.component.mount(this.component.equipment);

        this.component.setSkill(this.manager);

        this.component.generator.attachSelector(this, 'generator');
        this.component.spender.attachSelector(this, 'spender');

        this.component.combatJob.attachSelector(this, 'combatJob');
        this.component.passiveJob.attachSelector(this, 'passiveJob');

        this.renderQueue = new AdventuringHeroRenderQueue();
    }

    get media() {
        if(this.combatJob)
            return this.combatJob.media;
        return cdnMedia('assets/media/main/question.png');
    }

    get isHero() {
        return true;
    }

    postDataRegistration() {
        this.manager.stats.forEach(stat => {
            if(stat.base !== undefined)
                this.stats.set(stat, stat.base);
        });
        this.equipment.postDataRegistration();
    }

    onLoad() {
        super.onLoad();

        if(this.combatJob === undefined) // Default to None
            this.setCombatJob(this.manager.jobs.getObjectByID('adventuring:none'));
        if(this.passiveJob === undefined) // Default to None
            this.setPassiveJob(this.manager.jobs.getObjectByID('adventuring:none'));
        this.renderQueue.jobs = true;

        if(this.generator === undefined)
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));

        if(this.spender === undefined)
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.equipment.onLoad();

        this.calculateStats();
            
        if(this.name === undefined || this.name === "") { // Oh No
            this.name = this.getRandomName(this.manager.party.all.map(member => member.name));
            this.renderQueue.name = true;

            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;
        }

        this.card.icon = this.media;
        this.renderQueue.icon = true;
    }

    calculateStats() {
        let shouldAdjust = true;
        if(this.manager.isActive || this.hitpoints > this.maxHitpoints) // Loading Shenanigans
            shouldAdjust = false;
        let hitpointPct = this.hitpoints / this.maxHitpoints;

        this.stats.reset();

        this.manager.stats.forEach(stat => {
            if(stat.base !== undefined)
                this.stats.set(stat, stat.base);
        });

        if(this.combatJob !== undefined) {
            this.combatJob.calculateStats();
            this.combatJob.stats.forEach((value, stat) => this.stats.set(stat, this.stats.get(stat) + value));
        }

        if(this.passiveJob !== undefined) {
            this.passiveJob.calculateStats();
            this.passiveJob.stats.forEach((value, stat) => this.stats.set(stat, this.stats.get(stat) + value));
        }
        
        if(this.equipment !== undefined) {
            this.equipment.calculateStats();
            this.equipment.stats.forEach((value, stat) => this.stats.set(stat, this.stats.get(stat) + value));
        }

        // Tavern drink bonuses are now applied in getEffectiveStat()
        
        if(shouldAdjust)
            this.hitpoints = Math.min(this.maxHitpoints, Math.floor(this.maxHitpoints * hitpointPct));

        this.stats.renderQueue.stats = true;
        this.renderQueue.hitpoints = true;

        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }
    
    /**
     * Override to register hero-specific effect sources.
     */
    initEffectCache() {
        super.initEffectCache();
        
        // Register equipment as an effect source
        this.effectCache.registerSource('equipment', () => this.equipment.getEffects());
        
        // Register consumables (tavern drinks apply to all heroes)
        this.effectCache.registerSource('consumables', () => 
            this.manager.consumables ? this.manager.consumables.getEffects() : []
        );
        
        // Register Melvor modifiers as an effect source
        this.effectCache.registerSource('modifiers', () => 
            this.manager.modifiers ? this.manager.modifiers.getEffects() : []
        );
    }

    setLocked(locked) {
        this.locked = locked;
        this.renderQueue.jobs = true;
        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    // Override trigger to also check equipment effects
    trigger(type, extra={}) {
        // First call parent trigger for auras
        extra = super.trigger(type, extra);
        
        // Then check equipment for item effects
        if(this.equipment) {
            let itemEffects = this.equipment.trigger(type, extra);
            itemEffects.forEach(({ item, effect, amount, chance }) => {
                // Roll for chance-based effects
                if(Math.random() * 100 > chance) return;
                
                // Use the shared effect processor
                extra = this.processTriggeredEffect(effect, amount, extra, item.name);
            });
        }
        
        return extra;
    }

    setName(name) {
        this.name = name;
        this.renderQueue.name = true;
    }

    setCombatJob(combatJob) {
        this.combatJob = combatJob;
        this.calculateStats();

        if(!this.generator.canEquip(this))
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));
        
        if(!this.spender.canEquip(this))
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.passiveAbilities = true;
        this.stats.renderQueue.stats = true;

        this.equipment.slots.forEach(slot => slot.renderQueue.valid = true);

        this.manager.party.all.forEach(member => member.renderQueue.jobs = true);
    }

    setPassiveJob(passiveJob) {
        this.passiveJob = passiveJob;
        this.calculateStats();

        if(!this.generator.canEquip(this))
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));
        
        if(!this.spender.canEquip(this))
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.passiveAbilities = true;
        this.stats.renderQueue.stats = true;

        this.equipment.slots.forEach(slot => slot.renderQueue.valid = true);

        this.manager.party.all.forEach(member => member.renderQueue.jobs = true);
    }
    
    render() {
        super.render();
        this.renderJobs();
        this.renderPassiveAbilities();

        this.equipment.render();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.nameText.textContent = this.name;
        this.card.name = this.name;
        this.card.renderQueue.name = true;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.combatJob !== undefined && this.passiveJob !== undefined) {
            this.component.icon.classList.add('d-none');
            this.card.icon = this.combatJob.media;
            this.card.renderQueue.icon = true;
        } else {
            this.component.icon.classList.remove('d-none');
            this.component.icon.firstElementChild.src = this.combatJob.media;
            this.card.icon = this.combatJob.media;
            this.card.renderQueue.icon = true;
        }

        this.renderQueue.icon = false;
    }

    renderJobs() {
        if(!this.renderQueue.jobs)
            return;

        this.component.jobs.show();
        this.component.combatJob.icon.src = this.combatJob.media;
        if(this.component.combatJob.tooltip !== undefined)
            this.component.combatJob.tooltip.setContent(this.combatJob.tooltip);
        this.component.combatJob.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.combatJob.styling.classList.toggle('bg-combat-inner-dark', this.locked);

        this.component.passiveJob.icon.src = this.passiveJob.media;
        if(this.component.passiveJob.tooltip !== undefined)
            this.component.passiveJob.tooltip.setContent(this.passiveJob.tooltip);
        this.component.passiveJob.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.passiveJob.styling.classList.toggle('bg-combat-inner-dark', this.locked);

        // Trigger passive abilities update when jobs change
        this.renderQueue.passiveAbilities = true;

        this.renderQueue.jobs = false;
    }

    /**
     * Render active passive abilities for this character
     */
    renderPassiveAbilities() {
        if(!this.renderQueue.passiveAbilities)
            return;

        // Get passive abilities that this character has from their jobs
        const activePassives = [];
        
        // Get passives from combatJob
        if(this.combatJob && this.combatJob.id !== 'adventuring:none') {
            const combatPassives = this.manager.passives.allObjects.filter(p => 
                p.canEquip(this) && p.unlockedBy(this.combatJob)
            );
            activePassives.push(...combatPassives);
        }
        
        // Get passives from passiveJob (if different)
        if(this.passiveJob && this.passiveJob !== this.combatJob && this.passiveJob.id !== 'adventuring:none') {
            const passiveJobPassives = this.manager.passives.allObjects.filter(p => 
                p.canEquip(this) && p.unlockedBy(this.passiveJob) && !activePassives.includes(p)
            );
            activePassives.push(...passiveJobPassives);
        }

        // Update UI
        if(activePassives.length === 0) {
            this.component.passiveAbilitiesContainer.classList.add('d-none');
        } else {
            this.component.passiveAbilitiesContainer.classList.remove('d-none');
            this.component.passiveAbilitiesList.replaceChildren();
            
            activePassives.forEach(passive => {
                const badge = document.createElement('div');
                badge.className = 'bg-dark rounded p-1 px-2 m-1 d-flex align-items-center pointer-enabled';
                badge.style.border = '1px solid rgba(255, 255, 255, 0.2)';
                badge.innerHTML = `<small class="text-warning font-w600">${passive.name}</small>`;
                
                // Build tooltip using TooltipBuilder
                const tooltip = new TooltipBuilder();
                tooltip.header(passive.name, passive.media);
                tooltip.separator();
                tooltip.info(passive.getDescription(this));
                
                // Show which job provides this passive
                const sourceJob = passive.requirements.find(r => r.type === 'current_job_level');
                if(sourceJob) {
                    const job = this.manager.jobs.getObjectByID(sourceJob.job);
                    if(job) {
                        tooltip.separator();
                        tooltip.text(`From: <img class="skill-icon-xxs mx-1" src="${job.media}">${job.name} Lv.${sourceJob.level}`, 'text-muted text-center');
                    }
                }
                
                tippy(badge, {
                    content: tooltip.build(),
                    allowHTML: true,
                    placement: 'top'
                });
                
                this.component.passiveAbilitiesList.appendChild(badge);
            });
        }

        this.renderQueue.passiveAbilities = false;
    }

    renderGenerator() {
        if(!this.renderQueue.generator)
            return;

        this.component.generator.nameText.textContent = this.generator.name;
        if(this.component.generator.tooltip !== undefined)
            this.component.generator.tooltip.setContent(this.component.generator.buildAbilityTooltip(this.generator));
        this.component.generator.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-inner-dark', this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-menu-selected', this.generator === this.action && this.highlight);

        this.renderQueue.generator = false;
    }

    renderSpender() {
        if(!this.renderQueue.spender)
            return;

        this.component.spender.nameText.textContent = this.spender.name;
        if(this.component.spender.tooltip !== undefined)
            this.component.spender.tooltip.setContent(this.component.spender.buildAbilityTooltip(this.spender));
        this.component.spender.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.spender.styling.classList.toggle('bg-combat-inner-dark', this.locked);
        this.component.spender.styling.classList.toggle('bg-combat-menu-selected', this.spender === this.action && this.highlight);

        this.renderQueue.spender = false;
    }

    getRandomName(exclude=[]) {
        let names = [
            "Frea",
            "Pasa",
            "Charchel",
            "Ridtom",
            "Terda",
            "Cynsa",
            "Danald",
            "Kaar",
            "Swithbert",
            "Wil",
            "Holesc",
            "Trini",
            "Wardi",
            "Ardi",
            "Georever",
            "Berbrand",
            "Tolpher",
            "Tim-ke",
            "Fridles",
            "Arpher"
        ].filter(name => !exclude.includes(name));

        return names[Math.floor(Math.random()*names.length)];
    }
    
    encode(writer) {
        super.encode(writer);
        writer.writeString(this.name);
        writer.writeNamespacedObject(this.combatJob);
        writer.writeNamespacedObject(this.passiveJob);
        this.equipment.encode(writer);
        return writer;
    }

    decode(reader, version) {
        super.decode(reader, version);
        this.name = reader.getString();

        const combatJob = reader.getNamespacedObject(this.manager.jobs);
        if (typeof combatJob === 'string')
            this.setCombatJob(undefined);
        else
            this.setCombatJob(combatJob);

        const passiveJob = reader.getNamespacedObject(this.manager.jobs);
        if (typeof passiveJob === 'string')
            this.setPassiveJob(undefined);
        else
            this.setPassiveJob(passiveJob);
        this.equipment.decode(reader, version);
    }
}