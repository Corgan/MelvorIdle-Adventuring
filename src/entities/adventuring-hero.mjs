const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { AdventuringEquipment } = await loadModule('src/items/adventuring-equipment.mjs');
const { AdventuringStats } = await loadModule('src/core/stats/adventuring-stats.mjs');
const { AdventuringCard } = await loadModule('src/ui/adventuring-card.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringPassiveBadgeElement } = await loadModule('src/entities/components/adventuring-passive-badge.mjs');
const { StatCalculator } = await loadModule('src/core/stats/stat-calculator.mjs');
const { evaluateCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');
const { StatBreakdownCache } = await loadModule('src/core/stats/adventuring-stat-breakdown.mjs');
const { getStarterLoadouts } = await loadModule('src/core/effects/effect-descriptions.mjs');

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

        this._statsDirty = true;
        
        // Stat breakdown cache for tooltip display
        this.statBreakdownCache = new StatBreakdownCache(this, manager);

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

    getParty(type) {
        if (type === 'ally') return this.manager.party;
        if (type === 'enemy') return this.manager.encounter?.party;
        return null;
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

        this.component.setNameClickHandler(() => this.promptRename());

        const isNewPlayer = this.name === undefined || this.name === "";

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

        if(isNewPlayer) {

            this.name = this.getRandomName(this.manager.party.all.map(member => member.name));
            this.renderQueue.name = true;

            this._applyStarterLoadout();

            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;
        }

        this.card.icon = this.media;
        this.renderQueue.icon = true;
    }

    _getPartyPosition() {
        if(this === this.manager.party.front) return 'front';
        if(this === this.manager.party.center) return 'center';
        if(this === this.manager.party.back) return 'back';
        return 'front'; // fallback
    }

    _applyStarterLoadout() {
        const position = this._getPartyPosition();
        const loadouts = getStarterLoadouts();
        const loadout = loadouts[position];
        if(!loadout) return;

        const job = this.manager.jobs.getObjectByID(loadout.job);
        if(job) {
            this.setCombatJob(job);
        }

        if(loadout.generator) {
            const generator = this.manager.generators.getObjectByID(loadout.generator);
            if(generator) {
                this.setGenerator(generator);
            }
        }

        if(loadout.spender) {
            const spender = this.manager.spenders.getObjectByID(loadout.spender);
            if(spender) {
                this.setSpender(spender);
            }
        }

        this.calculateStats();
    }

    invalidateStats() {
        this._statsDirty = true;
        // Also invalidate stat breakdown cache
        if (this.statBreakdownCache) {
            this.statBreakdownCache.invalidate();
        }
    }

    calculateStats(force = false) {
        if (!force && !this._statsDirty) return;
        this._statsDirty = false;

        let shouldAdjust = !this.manager.isActive;
        let hitpointPct = this.hitpoints / this.maxHitpoints;

        this.stats.reset();

        this.manager.stats.forEach(stat => {
            if(stat.base !== undefined)
                this.stats.set(stat, stat.base);
        });

        // Job and equipment stats flow through effectCache via getEffects()
        // We still call calculateStats() for UI display (tooltips)
        if(this.combatJob !== undefined) this.combatJob.calculateStats();
        if(this.passiveJob !== undefined) this.passiveJob.calculateStats();
        if(this.equipment !== undefined) this.equipment.calculateStats();

        // All stat sources now flow through effectCache - no aggregate needed

        if(shouldAdjust) {
            this.hitpoints = Math.min(this.maxHitpoints, Math.floor(this.maxHitpoints * hitpointPct));
        } else {

            this.hitpoints = Math.min(this.hitpoints, this.maxHitpoints);
        }
        
        // Invalidate stat breakdown cache after recalculation
        if (this.statBreakdownCache) {
            this.statBreakdownCache.invalidate();
        }

        this.stats.renderQueue.stats = true;
        this.renderQueue.hitpoints = true;

        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    initEffectCache() {
        super.initEffectCache();

        // Unified equipment source - stats + procs + set bonuses all in one
        this.effectCache.registerSource('equipment', () => 
            this.equipment?.getEffects ? this.equipment.getEffects() : []
        );
        
        // Unified combat job source - stats + passives all in one
        this.effectCache.registerSource('combatJob', () => {
            if (!this.combatJob || this.combatJob.id === 'adventuring:none') return [];
            return this.combatJob.getEffects ? this.combatJob.getEffects(this, 'combatJob') : [];
        });
        
        // Unified passive job source - stats + passives all in one
        this.effectCache.registerSource('passiveJob', () => {
            if (!this.passiveJob || this.passiveJob === this.combatJob || this.passiveJob.id === 'adventuring:none') return [];
            return this.passiveJob.getEffects ? this.passiveJob.getEffects(this, 'passiveJob') : [];
        });
        
        // Global passives (achievement-unlocked)
        this.effectCache.registerSource('globalPassives', () => 
            this.manager.getGlobalPassiveEffects ? this.manager.getGlobalPassiveEffects(this) : []
        );
        
        // Shared sources filtered for individual (non-party) scope
        this.effectCache.registerSource('consumables', {
            getEffects: (f) => this.manager.consumables?.getEffects(f) || [],
            filters: { scope: 'individual' },
            onTrigger: (effect, context, host) => {
                // Get display name from sourcePath
                const sourceName = effect.sourcePath && effect.sourcePath.length > 0 
                    ? effect.sourcePath[effect.sourcePath.length - 1].name 
                    : 'Consumable';
                const sourceRef = effect.sourcePath && effect.sourcePath.length > 0 
                    ? effect.sourcePath[effect.sourcePath.length - 1].ref 
                    : effect.source;
                    
                // Handle consume_charge effect type
                if (effect.type === 'consume_charge') {
                    const count = effect.count || 1;
                    this.manager.consumables.removeCharges(sourceRef, effect.sourceTier, count);
                    this.manager.log.add(`${sourceName} consumed ${count} charge(s).`, {
                        category: 'system',
                        source: this
                    });
                }
                // Consume charges for triggered consumable effects (non-passive)
                else if (effect.trigger !== 'passive') {
                    this.manager.consumables.removeCharges(sourceRef, effect.sourceTier, 1);
                    this.manager.log.add(`${sourceName} consumed a charge.`, {
                        category: 'system',
                        source: this
                    });
                }
            }
        });
        
        this.effectCache.registerSource('tavern', {
            getEffects: (f) => this.manager.tavern?.getEffects(f) || [],
            filters: { scope: 'individual' }
        });

        // Party-shared effects (including enemies targeting heroes)
        this.effectCache.registerSource('party', () =>
            this.manager.party?.getEffects() || []
        );
    }

    /**
     * Invalidate one or more effect sources and update render queues.
     * @param {...string} sourceIds - The effect source IDs to invalidate
     */
    invalidateEffectSources(...sourceIds) {
        for (const sourceId of sourceIds) {
            this.effectCache.invalidate(sourceId);
        }
        this.stats.renderQueue.stats = true;
        if (this.statBreakdownCache) {
            this.statBreakdownCache.invalidate();
        }
    }

    invalidateJobEffects() {
        this.invalidateEffectSources('combatJob', 'passiveJob');
    }

    invalidateEquipmentEffects() {
        this.invalidateEffectSources('equipment');
    }

    setLocked(locked) {
        this.locked = locked;
        this.renderQueue.jobs = true;
        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    setName(name) {
        this.name = name;
        this.renderQueue.name = true;
    }

    promptRename() {
        SwalLocale.fire({
            title: 'Rename Hero',
            input: 'text',
            inputValue: this.name || '',
            inputPlaceholder: 'Enter a new name',
            showCancelButton: true,
            confirmButtonText: 'Rename',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'Please enter a name';
                }
                if (value.length > 20) {
                    return 'Name must be 20 characters or less';
                }
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                this.setName(result.value.trim());
                this.manager.log.add(`Hero renamed to ${this.name}`, {
                    category: 'system',
                    source: this
                });
            }
        });
    }

    _onJobChange() {
        // Update cached mastery bonus before stats are calculated
        if (this.combatJob?.updateCachedMasteryBonus) {
            this.combatJob.updateCachedMasteryBonus();
        }
        if (this.passiveJob?.updateCachedMasteryBonus) {
            this.passiveJob.updateCachedMasteryBonus();
        }
        
        this.invalidateStats();
        this.invalidateJobEffects();
        this.calculateStats();

        if(!this.generator.canEquip(this))
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));

        if(!this.spender.canEquip(this))
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.renderQueue.name = true;
        this.renderQueue.icon = true;
        this.renderQueue.passiveAbilities = true;
        this.stats.renderQueue.stats = true;

        this.equipment.slots.forEach(slot => {
            slot.renderQueue.valid = true;
            slot.renderQueue.icon = true;
            slot.renderQueue.upgrade = true;
        });

        this.manager.party.forEach(member => member.renderQueue.jobs = true);
    }

    setCombatJob(combatJob) {
        this.combatJob = combatJob;
        this._onJobChange();
    }

    setPassiveJob(passiveJob) {
        this.passiveJob = passiveJob;
        this._onJobChange();
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
        this.component.combatJob.setTooltipContent(this.combatJob.tooltip);
        this.component.combatJob.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.combatJob.styling.classList.toggle('bg-combat-inner-dark', this.locked);

        this.component.passiveJob.icon.src = this.passiveJob.media;
        this.component.passiveJob.setTooltipContent(this.passiveJob.tooltip);
        this.component.passiveJob.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.passiveJob.styling.classList.toggle('bg-combat-inner-dark', this.locked);

        this.renderQueue.passiveAbilities = true;

        this.renderQueue.jobs = false;
    }

    renderPassiveAbilities() {
        if(!this.renderQueue.passiveAbilities)
            return;

        const activePassives = [];

        if(this.combatJob && this.combatJob.id !== 'adventuring:none') {
            const combatPassives = this.manager.getPassivesForJob(this.combatJob)
                .filter(p => p.canEquip(this));
            activePassives.push(...combatPassives);
        }

        if(this.passiveJob && this.passiveJob !== this.combatJob && this.passiveJob.id !== 'adventuring:none') {
            const passiveJobPassives = this.manager.getPassivesForJob(this.passiveJob)
                .filter(p => p.canEquip(this) && !activePassives.includes(p));
            activePassives.push(...passiveJobPassives);
        }

        // Add global passives (achievement-unlocked passives)
        if(this.manager.getGlobalPassives) {
            const globalPassives = this.manager.getGlobalPassives()
                .filter(p => p.canEquip(this) && !activePassives.includes(p));
            activePassives.push(...globalPassives);
        }

        if(activePassives.length === 0) {
            this.component.passiveAbilitiesContainer.classList.add('d-none');
        } else {
            this.component.passiveAbilitiesContainer.classList.remove('d-none');
            this.component.passiveAbilitiesList.replaceChildren();

            activePassives.forEach(passive => {

                const tooltip = new TooltipBuilder();
                tooltip.header(passive.name, passive.media);
                tooltip.separator();
                tooltip.info(passive.getDescription(this));

                const sourceJob = passive.requirements.find(r => r.type === 'current_job_level');
                const sourceAchievement = passive.requirements.find(r => r.type === 'achievement_completion');
                if(sourceJob) {
                    const job = this.manager.jobs.getObjectByID(sourceJob.job);
                    if(job) {
                        tooltip.separator();
                        tooltip.text(`From: <img class="skill-icon-xxs mx-1" src="${job.media}">${job.name} Lv.${sourceJob.level}`, 'text-muted text-center');
                    }
                } else if(sourceAchievement) {
                    const achievement = this.manager.achievements.getObjectByID(sourceAchievement.id);
                    if(achievement) {
                        tooltip.separator();
                        tooltip.text(`From: <img class="skill-icon-xxs mx-1" src="${achievement.media}">Achievement: ${achievement.name}`, 'text-muted text-center');
                    }
                }

                const badge = new AdventuringPassiveBadgeElement();
                this.component.passiveAbilitiesList.appendChild(badge);
                badge.setPassive(passive.name, tooltip.build());
            });
        }

        this.renderQueue.passiveAbilities = false;
    }

    renderGenerator() {
        if(!this.renderQueue.generator)
            return;

        this.component.generator.nameText.textContent = this.generator.name;
        this.component.generator.setTooltipContent(this.component.generator.buildAbilityTooltip(this.generator));
        this.component.generator.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-inner-dark', this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-menu-selected', this.generator === this.action && this.highlight);

        this.renderQueue.generator = false;
    }

    renderSpender() {
        if(!this.renderQueue.spender)
            return;

        this.component.spender.nameText.textContent = this.spender.name;
        this.component.spender.setTooltipContent(this.component.spender.buildAbilityTooltip(this.spender));
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
        
        // Mark stats dirty after equipment is loaded so calculateStats runs in onLoad
        this.invalidateStats();
    }
}