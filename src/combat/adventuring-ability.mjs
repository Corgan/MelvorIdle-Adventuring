const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { RequirementsChecker, buildHitEffectReplacements, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringAbilityElement } = await loadModule('src/combat/components/adventuring-ability.mjs');
const { AdventuringAbilityDetailsElement } = await loadModule('src/combat/components/adventuring-ability-details.mjs');

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

class AdventuringAbilityHitEffect extends AdventuringScalableEffect {
    constructor(manager, game, ability, hit, data) {
        super(manager, game, data);
        this.hit = hit;
        this.ability = ability;

        if(data.energy !== undefined)
            this.energy = data.energy;
    }

    postDataRegistration() {
        super.postDataRegistration();
        
        // Auto-populate stacks for buff/debuff effects (default to 1)
        if(this.type === "buff" || this.type === "debuff") {
            if(this.stacks === undefined) {
                this.stacks = { base: 1 };
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
        if(data.learnType)
            this.learnType = data.learnType;
        if(data.learnBonus !== undefined)
            this.learnBonus = data.learnBonus;
        this.isEnemy = data.isEnemy === true;
        // Auto-detect achievement abilities by checking requirements
        this.isAchievementAbility = data.isAchievementAbility === true || 
            (data.requirements && data.requirements.some(r => r.type === 'achievement_completion'));
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
        if (this._reqChecker === undefined) return false;
        return this._reqChecker.referencesJob(job.id);
    }

    get unlocked() {
        // Enemy abilities are unlocked if learned by Blue Mage
        if(this.isEnemy)
            return this.manager.learnedAbilities.has(this.id);
        
        // Achievement abilities are unlocked via achievement completion
        if(this.isAchievementAbility)
            return this.manager.achievementManager.isAbilityUnlocked(this.id);
        
        // Use RequirementsChecker for standard job_level requirements
        // Note: For unlocked, we treat current_job_level same as job_level
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check();
    }

    canEquip(character) {
        // Blue Mage (Slayer) can equip learned enemy abilities
        if(this.isEnemy) {
            if(!this.manager.learnedAbilities.has(this.id)) return false;
            const slayerJob = this.manager.cached.slayerJob;
            if(slayerJob === undefined) return false;
            return (character.combatJob === slayerJob) || (character.passiveJob === slayerJob);
        }
        
        // Achievement abilities can be equipped by anyone once unlocked
        if(this.isAchievementAbility) {
            return this.manager.achievementManager.isAbilityUnlocked(this.id);
        }
        
        // Use RequirementsChecker with character context for current_job_level
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check({ character });
    }

    /**
     * Get the ability description with effect values.
     * 
     * Display modes:
     * - 'total': Just totals (25) - for tooltips/ability-small
     * - 'scaled': Base + scaled value (5 + 20 icon) - for ability selector
     * - 'multiplier': Base + multiplier (5 + 0.5 icon) - for job overview
     * - false: Raw numbers for logic
     * 
     * @param {object} stats - Stats source for scaling calculations
     * @param {string} displayMode - Display mode: 'total', 'scaled', 'multiplier', or falsy for raw
     */
    getDescription(stats, displayMode) {
        const desc = buildDescription({
            hits: this.hits,
            manager: this.manager,
            template: this._descriptionTemplate,
            flavorText: this.flavorText,
            stats: stats,
            displayMode: displayMode,
            includeTrigger: false,
            buildReplacements: buildHitEffectReplacements
        });
        return desc !== '' ? desc : 'No effect.';
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

            // Ability selector: show base + scaled value (5 + 20 icon)
            this.component.description.innerHTML = this.getDescription(stats, 'scaled');
            
            // Job overview/details: show base + multiplier (5 + 0.5 icon)
            this.details.description.innerHTML = this.getDescription(undefined, 'multiplier');

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
