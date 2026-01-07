const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { AdventuringEquipment } = await loadModule('src/items/adventuring-equipment.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringPassiveBadgeElement } = await loadModule('src/entities/components/adventuring-passive-badge.mjs');
const { evaluateCondition, getAuraName, StatCalculator } = await loadModule('src/core/adventuring-utils.mjs');

/**
 * Starter loadouts for new players.
 * Each hero position (front/center/back) gets a job, abilities, and gear set.
 */
const STARTER_LOADOUTS = {
    front: {
        job: 'adventuring:fighter',
        generator: 'adventuring:slash',
        spender: 'adventuring:whirlwind',
        gear: {
            weapon: 'adventuring:bronze_sword1h',
            offhand: 'adventuring:bronze_shield',
            head: 'adventuring:might_helm',
            body: 'adventuring:might_platebody',
            legs: 'adventuring:might_platelegs',
            hands: 'adventuring:might_gauntlets',
            feet: 'adventuring:might_sabatons'
        }
    },
    center: {
        job: 'adventuring:cleric',
        generator: 'adventuring:holy_fire',
        spender: 'adventuring:divine_heal',
        gear: {
            weapon: 'adventuring:healing_staff',
            head: 'adventuring:devotion_hat',
            body: 'adventuring:devotion_robes',
            legs: 'adventuring:devotion_bottoms',
            hands: 'adventuring:devotion_mitts',
            feet: 'adventuring:devotion_slippers'
        }
    },
    back: {
        job: 'adventuring:ranger',
        generator: 'adventuring:shoot',
        spender: 'adventuring:snipe',
        gear: {
            weapon: 'adventuring:normal_shortbow',
            offhand: 'adventuring:basic_quiver',
            head: 'adventuring:precision_cowl',
            body: 'adventuring:precision_vest',
            legs: 'adventuring:precision_chaps',
            hands: 'adventuring:precision_vambraces',
            feet: 'adventuring:precision_boots'
        }
    }
};

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

        // Set up name click handler for renaming via component callback
        this.component.setNameClickHandler(() => this.promptRename());

        // Check if this is a new player (no name = first time)
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
            // Assign name
            this.name = this.getRandomName(this.manager.party.all.map(member => member.name));
            this.renderQueue.name = true;

            // Apply starter loadout based on party position
            this._applyStarterLoadout();

            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;
        }

        this.card.icon = this.media;
        this.renderQueue.icon = true;
    }

    /**
     * Determine this hero's position in the party (front/center/back)
     * @returns {string} 'front', 'center', or 'back'
     */
    _getPartyPosition() {
        if(this === this.manager.party.front) return 'front';
        if(this === this.manager.party.center) return 'center';
        if(this === this.manager.party.back) return 'back';
        return 'front'; // fallback
    }

    /**
     * Apply starter job, abilities, and gear for new players based on party position.
     */
    _applyStarterLoadout() {
        const position = this._getPartyPosition();
        const loadout = STARTER_LOADOUTS[position];
        if(!loadout) return;

        // Set combat job
        const job = this.manager.jobs.getObjectByID(loadout.job);
        if(job) {
            this.setCombatJob(job);
        }

        // Set generator
        if(loadout.generator) {
            const generator = this.manager.generators.getObjectByID(loadout.generator);
            if(generator) {
                this.setGenerator(generator);
            }
        }

        // Set spender
        if(loadout.spender) {
            const spender = this.manager.spenders.getObjectByID(loadout.spender);
            if(spender) {
                this.setSpender(spender);
            }
        }

        // Pre-craft and equip starter gear
        for(const [slotName, itemId] of Object.entries(loadout.gear)) {
            // Pre-craft the item (unlock + upgrade to level 1)
            const item = this.manager.armory.preCraftItem(itemId);
            if(!item) continue;

            // Find the equipment slot
            const slotType = this.manager.itemSlots.getObjectByID(`adventuring:${slotName}`);
            if(!slotType) continue;

            const slot = this.equipment.slots.get(slotType);
            if(slot && slot.canEquip(item)) {
                slot.setEquipped(item);
            }
        }

        // Recalculate stats after equipping
        this.calculateStats();
    }

    calculateStats() {
        let shouldAdjust = true;
        if(this.manager.isActive || this.hitpoints > this.maxHitpoints) // Loading Shenanigans
            shouldAdjust = false;
        let hitpointPct = this.hitpoints / this.maxHitpoints;

        this.stats.reset();

        // Set base stats
        this.manager.stats.forEach(stat => {
            if(stat.base !== undefined)
                this.stats.set(stat, stat.base);
        });

        // Calculate job and equipment stats
        if(this.combatJob !== undefined) this.combatJob.calculateStats();
        if(this.passiveJob !== undefined) this.passiveJob.calculateStats();
        if(this.equipment !== undefined) this.equipment.calculateStats();
        
        // Aggregate all stat sources
        StatCalculator.aggregate(this.stats,
            this.combatJob?.stats,
            this.passiveJob?.stats,
            this.equipment?.stats
        );

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
        
        // Register tavern drinks (passive run-length effects)
        this.effectCache.registerSource('tavern', () => 
            this.manager.tavern ? this.manager.tavern.getEffects() : []
        );
        
        // Register consumables (triggered effects)
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

    /**
     * Override to add hero-specific effect sources: equipment, consumables, passives.
     * @override
     */
    getAllPendingEffectsForTrigger(type, context) {
        // Get base sources (currently empty in parent, but could have party-level sources)
        const pending = super.getAllPendingEffectsForTrigger(type, context);
        
        // Add equipment effects (character-scoped only, party-scoped handled by Party.trigger)
        if (this.equipment) {
            const equipmentEffects = this.equipment.getEffectsForTrigger(type, context);
            for (const { item, effect } of equipmentEffects) {
                if (effect.scope === 'party') continue; // Skip party-scoped
                pending.push({
                    effect,
                    source: item,
                    sourceName: item.name,
                    sourceType: 'equipment'
                });
            }
        }
        
        // Add consumable effects (character-scoped only, party-scoped handled by Party.trigger)
        if (this.manager.consumables) {
            const consumableEffects = this.manager.consumables.getEffectsForTrigger(type, context);
            for (const { consumable, tier, effect } of consumableEffects) {
                if (effect.scope === 'party') continue; // Skip party-scoped
                pending.push({
                    effect,
                    source: consumable,
                    sourceTier: tier,
                    sourceName: consumable.name,
                    sourceType: 'consumable'
                });
            }
        }
        
        // Add job passive effects (combat job) - use job's own method
        if (this.combatJob && this.combatJob.getPassivesForTrigger) {
            const passiveEffects = this.combatJob.getPassivesForTrigger(this, type);
            for (const { passive, effect } of passiveEffects) {
                pending.push({
                    effect,
                    source: passive,
                    sourceName: `${this.combatJob.name} (${passive.name})`,
                    sourceType: 'jobPassive'
                });
            }
        }
        
        // Add passive job effects
        if (this.passiveJob && this.passiveJob !== this.combatJob && this.passiveJob.getPassivesForTrigger) {
            const passiveEffects = this.passiveJob.getPassivesForTrigger(this, type);
            for (const { passive, effect } of passiveEffects) {
                pending.push({
                    effect,
                    source: passive,
                    sourceName: `${this.passiveJob.name} (${passive.name})`,
                    sourceType: 'jobPassive'
                });
            }
        }
        
        // Add tavern drink effects (character-scoped only, party-scoped handled by Party.trigger)
        if (this.manager.tavern) {
            const drinkEffects = this.manager.tavern.getEffectsForTrigger(type, context);
            for (const { drink, effect } of drinkEffects) {
                if (effect.scope === 'party') continue; // Skip party-scoped
                pending.push({
                    effect,
                    source: drink,
                    sourceName: drink.name,
                    sourceType: 'tavernDrink'
                });
            }
        }
        
        return pending;
    }
    
    /**
     * Override to handle special processing for different source types.
     * - Consumables: consume a charge after triggering
     * - Job Passives: use passive's target resolution
     * - consume_charge effects: explicitly consume charges
     * @override
     */
    processPendingEffect(pending, context) {
        const { effect, source, sourceTier, sourceName, sourceType } = pending;
        
        // For job passives, use the passive's built-in apply logic (with target resolution)
        if (sourceType === 'jobPassive') {
            return this.processJobPassiveEffect(pending, context);
        }
        
        // Handle consume_charge effect type (for consumables with passive effects)
        if (effect.type === 'consume_charge' && sourceType === 'consumable') {
            const count = effect.count || 1;
            this.manager.consumables.removeCharges(source, sourceTier, count);
            this.manager.log.add(`${sourceName} consumed ${count} charge(s).`);
            return true;
        }
        
        // For other sources, use the standard processing
        const applied = super.processPendingEffect(pending, context);
        
        // If this was a consumable effect that applied (not passive), consume a charge
        if (applied && sourceType === 'consumable' && effect.trigger !== 'passive') {
            this.manager.consumables.removeCharges(source, sourceTier, 1);
            this.manager.log.add(`${sourceName} consumed a charge.`);
        }
        
        return applied;
    }
    
    /**
     * Process a job passive effect with condition/limit checking.
     * Uses the passive's target resolution but adds unified condition/limit evaluation.
     * @param {object} pending - Pending effect with passive and effect
     * @param {object} context - Effect context
     * @returns {boolean} Whether the effect was applied
     */
    processJobPassiveEffect(pending, context) {
        const { effect, source: passive, sourceName } = pending;
        
        // Check condition if present (evaluateCondition imported at module level)
        if (effect.condition) {
            if (!evaluateCondition(effect.condition, context)) {
                return false;
            }
        }
        
        // Check limit if present
        if (!this.canEffectTrigger(effect, passive)) {
            return false;
        }
        
        // Roll for chance if present
        const chance = effect.chance || 100;
        if (Math.random() * 100 > chance) {
            return false;
        }
        
        // Use the passive's built-in apply logic for this single effect
        // Get encounter from context (passed in from encounter triggers)
        const encounter = context.encounter;
        
        let builtEffect = {
            amount: effect.getAmount ? effect.getAmount(this) : (effect.amount || 0),
            stacks: effect.getStacks ? effect.getStacks(this) : (effect.stacks || 1)
        };
        
        // Resolve targets using passive's target resolution
        const targets = passive.resolveTargets(effect, this, encounter);
        
        let anyApplied = false;
        for (const target of targets) {
            if (target.dead) continue;
            
            if (effect.type === "buff") {
                const auraId = effect.id;
                if (!auraId) continue;
                target.buff(auraId, builtEffect, this);
                this.manager.log.add(`${this.name}'s ${passive.name} applies ${getAuraName(this.manager, auraId)} to ${target.name}`);
                anyApplied = true;
            } else if (effect.type === "debuff") {
                const auraId = effect.id;
                if (!auraId) continue;
                target.debuff(auraId, builtEffect, this);
                this.manager.log.add(`${this.name}'s ${passive.name} applies ${getAuraName(this.manager, auraId)} to ${target.name}`);
                anyApplied = true;
            } else if (effect.type === "heal" || effect.type === "heal_flat") {
                target.heal(builtEffect, this);
                this.manager.log.add(`${this.name}'s ${passive.name} heals ${target.name} for ${builtEffect.amount}`);
                anyApplied = true;
            } else if (effect.type === "damage" || effect.type === "damage_flat") {
                target.damage(builtEffect, this);
                this.manager.log.add(`${this.name}'s ${passive.name} deals ${builtEffect.amount} damage to ${target.name}`);
                anyApplied = true;
            }
        }
        
        // Record trigger if any effect applied
        if (anyApplied) {
            this.recordEffectTrigger(effect, passive);
        }
        
        return anyApplied;
    }

    setName(name) {
        this.name = name;
        this.renderQueue.name = true;
    }

    /**
     * Prompt user to rename this hero using SweetAlert2 modal
     */
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
                this.manager.log.add(`Hero renamed to ${this.name}`);
            }
        });
    }

    /**
     * Common logic after changing a job (combat or passive)
     * Recalculates stats, validates abilities, and queues renders
     */
    _onJobChange() {
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
        
        // Get passives from combatJob (use cached lookup)
        if(this.combatJob && this.combatJob.id !== 'adventuring:none') {
            const combatPassives = this.manager.getPassivesForJob(this.combatJob)
                .filter(p => p.canEquip(this));
            activePassives.push(...combatPassives);
        }
        
        // Get passives from passiveJob (if different, use cached lookup)
        if(this.passiveJob && this.passiveJob !== this.combatJob && this.passiveJob.id !== 'adventuring:none') {
            const passiveJobPassives = this.manager.getPassivesForJob(this.passiveJob)
                .filter(p => p.canEquip(this) && !activePassives.includes(p));
            activePassives.push(...passiveJobPassives);
        }

        // Update UI
        if(activePassives.length === 0) {
            this.component.passiveAbilitiesContainer.classList.add('d-none');
        } else {
            this.component.passiveAbilitiesContainer.classList.remove('d-none');
            this.component.passiveAbilitiesList.replaceChildren();
            
            activePassives.forEach(passive => {
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
    }
}