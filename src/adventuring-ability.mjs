const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { ScalableEffect } = await loadModule('src/adventuring-scalable-effect.mjs');
const { RequirementsChecker, buildHitEffectReplacements, parseDescription, describeEffectFull } = await loadModule('src/adventuring-utils.mjs');

const { AdventuringAbilityElement } = await loadModule('src/components/adventuring-ability.mjs');
const { AdventuringAbilityDetailsElement } = await loadModule('src/components/adventuring-ability-details.mjs');

class AdventuringAbilityRenderQueue {
    constructor() {
        this.name = false;
        this.description = false;
        this.highlight = false;
        this.descriptionCharacter = false;
        this.newBadge = false;
    }

    queueAll() {
        this.name = true;
        this.description = true;
        this.highlight = true;
        this.newBadge = true;
    }
}

class AdventuringAbilityHitEffect extends ScalableEffect {
    constructor(manager, game, ability, hit, data) {
        super(manager, game, data);
        this.hit = hit;
        this.ability = ability;

        if(data.energy !== undefined)
            this.energy = data.energy;
    }

    postDataRegistration() {
        super.postDataRegistration();
        
        // Auto-populate amount/stacks from aura defaults for buff/debuff effects
        if(this.type === "buff" || this.type === "debuff") {
            let aura = this.manager.auras.getObjectByID(this.id);
            if(aura !== undefined) {
                if(this.amount === undefined && aura.amount !== undefined) {
                    this.amount = { base: aura.amount };
                }
                if(this.stacks === undefined && aura.stacks !== undefined) {
                    this.stacks = { base: aura.stacks };
                }
            }
        }
    }
}

class AdventuringAbilityHit {
    constructor(manager, game, ability, data) {
        this.manager = manager;
        this.game = game;
        this.ability = ability;
        this.target = data.target;
        this.party = data.party;

        this.effects = data.effects.map(effect => new AdventuringAbilityHitEffect(this.manager, this.game, this.ability, this, effect));

        if(data.delay !== undefined)
            this.delay = data.delay;
        if(data.repeat !== undefined)
            this.repeat = data.repeat;
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }
}

export class AdventuringAbility extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name;
        this._descriptionTemplate = data.description; // Template with placeholders like {hit.0.effect.0.amount}
        this.flavorText = data.flavorText; // Optional flavor text
        this.hits = data.hits.map(hit => new AdventuringAbilityHit(this.manager, this.game, this, hit));
        if(data.energy)
            this.energy = data.energy;
        if(data.cost)
            this.cost = data.cost;
        this.isEnemy = data.isEnemy === true;
        this.isAchievementAbility = data.isAchievementAbility === true;
        this.requirements = data.requirements;
        this.highlight = false;

        this.component = createElement('adventuring-ability');
        this.component.setAbility(this);

        this.details = createElement('adventuring-ability-details');

        this.renderQueue = new AdventuringAbilityRenderQueue();
    }

    postDataRegistration() {
        this.hits.forEach(hit => hit.postDataRegistration());
        // Create requirements checker for this ability
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
    }

    /**
     * Check if this ability is unlocked by a specific job
     * @param {object} job - Job to check
     * @returns {boolean} True if this ability references the job in requirements
     */
    unlockedBy(job) {
        if(this.isEnemy) return false;
        return this._reqChecker?.referencesJob(job.id) ?? false;
    }

    get unlocked() {
        // Enemy abilities are unlocked if learned by Blue Mage
        if(this.isEnemy)
            return this.manager.learnedAbilities.has(this.id);
        
        // Achievement abilities are unlocked via achievement completion
        if(this.isAchievementAbility)
            return this.manager.unlockedAchievementAbilities.has(this.id);
        
        // Use RequirementsChecker for standard job_level requirements
        // Note: For unlocked, we treat current_job_level same as job_level
        return this._reqChecker?.check() ?? true;
    }

    canEquip(character) {
        // Blue Mage (Slayer) can equip learned enemy abilities
        if(this.isEnemy) {
            if(!this.manager.learnedAbilities.has(this.id)) return false;
            const slayerJob = this.manager.jobs.getObjectByID('adventuring:slayer');
            if(!slayerJob) return false;
            return (character.combatJob === slayerJob) || (character.passiveJob === slayerJob);
        }
        
        // Achievement abilities can be equipped by anyone once unlocked
        if(this.isAchievementAbility) {
            return this.manager.unlockedAchievementAbilities.has(this.id);
        }
        
        // Use RequirementsChecker with character context for current_job_level
        return this._reqChecker?.check({ character }) ?? true;
    }

    getDescription(stats, isDesc=false) {
        // If we have a template description, use it with placeholders
        if(this._descriptionTemplate) {
            const replacements = buildHitEffectReplacements(this.hits, stats, isDesc);
            let desc = parseDescription(this._descriptionTemplate, replacements);
            if(this.flavorText) {
                desc = `${desc}\n\n${this.flavorText}`;
            }
            return desc;
        }
        
        // Auto-generate from hit effects
        const effectDescs = [];
        this.hits.forEach((hit, hitIndex) => {
            hit.effects.forEach(effect => {
                // Build a simplified effect object for description
                const effectObj = {
                    type: effect.type,
                    trigger: effect.trigger || 'on_hit',
                    value: effect.getAmount ? effect.getAmount(stats, isDesc) : (effect.amount?.base || effect.amount || 0),
                    stacks: effect.getStacks ? effect.getStacks(stats, isDesc) : (effect.stacks?.base || effect.stacks || 0),
                    id: effect.id,
                    target: hit.target,
                    condition: effect.condition,
                    chance: effect.chance
                };
                effectDescs.push(describeEffectFull(effectObj, this.manager));
            });
        });
        
        let generated = effectDescs.join('. ');
        if(this.flavorText) {
            generated = generated ? `${generated}.\n\n${this.flavorText}` : this.flavorText;
        }
        return generated || 'No effect.';
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
    }

    render() {
        this.renderName();
        this.renderDescription();
        this.renderHighlight();
        this.renderNewBadge();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.nameText.textContent = this.name;
            this.details.nameText.textContent = this.name;
        } else {
            this.component.nameText.textContent = "???";
            this.details.nameText.textContent = "???";
        }

        this.renderQueue.name = false;
    }

    renderDescription() {
        if(!this.renderQueue.description)
            return;

        if(this.unlocked) {
            let stats = undefined;
            if(this.renderQueue.descriptionCharacter)
                stats = this.renderQueue.descriptionCharacter.stats;

            this.component.description.innerHTML = this.getDescription(stats, true);
            
            this.details.description.innerHTML = this.getDescription(undefined, true);

        } else {
            this.details.description.textContent = "???";
        }

        this.renderQueue.description = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.styling.classList.toggle('bg-combat-menu-selected', this.highlight && this.unlocked);

        this.renderQueue.highlight = false;
    }

    renderNewBadge() {
        if(!this.renderQueue.newBadge)
            return;
        
        let isNew = this.unlocked && !this.manager.seenAbilities.has(this.id);
        if(this.component.newBadge !== undefined)
            this.component.newBadge.classList.toggle('d-none', !isNew);
        if(this.details.newBadge !== undefined)
            this.details.newBadge.classList.toggle('d-none', !isNew);
        
        this.renderQueue.newBadge = false;
    }
}