const { loadModule } = mod.getContext(import.meta);

const { AdventuringHero } = await loadModule('src/entities/adventuring-hero.mjs');
const { AdventuringEnemy } = await loadModule('src/entities/adventuring-enemy.mjs');
const { AdventuringPartyElement } = await loadModule('src/entities/components/adventuring-party.mjs');
const { evaluateCondition, buildEffectContext, createEffect, EffectLimitTracker } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringParty {
    constructor(manager, game) {
        this.game = game;
        this.manager = manager;
        
        this.component = createElement('adventuring-party');
        
        // Effect trigger limit tracking (shared implementation)
        this.effectLimitTracker = new EffectLimitTracker();
    }
    
    /**
     * Invalidate effect cache for all party members
     * @param {string} source - The source of the invalidation
     */
    invalidateAllEffects(source) {
        this.forEach(hero => {
            if (hero.effectCache) {
                hero.invalidateEffects(source);
            }
        });
    }

    get all() {
        return [this.front, this.center, this.back];
    }

    /** Get all alive party members */
    get alive() {
        return this.all.filter(member => !member.dead);
    }

    /** Get all dead party members */
    get dead() {
        return this.all.filter(member => member.dead);
    }
    
    // =========================================================================
    // Party Convenience Methods
    // =========================================================================
    
    /**
     * Iterate over all party members.
     * @param {function} callback - Function called with (member, index)
     */
    forEach(callback) {
        this.all.forEach(callback);
    }
    
    /**
     * Iterate over all living party members.
     * @param {function} callback - Function called with (member, index)
     */
    forEachLiving(callback) {
        this.alive.forEach(callback);
    }
    
    /**
     * Find a party member matching a predicate.
     * @param {function} predicate - Function returning true for match
     * @returns {object|undefined} Matching member or undefined
     */
    find(predicate) {
        return this.all.find(predicate);
    }
    
    /**
     * Check if any party member matches a predicate.
     * @param {function} predicate - Function returning true for match
     * @returns {boolean}
     */
    some(predicate) {
        return this.all.some(predicate);
    }
    
    /**
     * Check if all party members match a predicate.
     * @param {function} predicate - Function returning true for match
     * @returns {boolean}
     */
    every(predicate) {
        return this.all.every(predicate);
    }
    
    /**
     * Get the member with the lowest HP (among living).
     * @returns {object|undefined} Member with lowest HP
     */
    get lowestHp() {
        const living = this.alive;
        if (living.length === 0) return undefined;
        return living.reduce((low, m) => m.hitpoints < low.hitpoints ? m : low);
    }
    
    /**
     * Get a random living party member.
     * @returns {object|undefined} Random living member
     */
    get randomLiving() {
        const living = this.alive;
        if (living.length === 0) return undefined;
        return living[Math.floor(Math.random() * living.length)];
    }

    /** Set locked state for all party members */
    setAllLocked(locked) {
        this.all.forEach(member => member.setLocked(locked));
    }
    
    // =========================================================================
    // Party-Level Trigger System (for scope: 'party' effects)
    // =========================================================================
    
    /**
     * Trigger party-scoped effects.
     * Called before individual hero triggers for each trigger type.
     * @param {string} type - Trigger type
     * @param {object} context - Trigger context
     */
    trigger(type, context = {}) {
        // Build context for party-level evaluation
        const partyContext = buildEffectContext(null, {
            ...context,
            party: this.all,
            manager: this.manager
        });
        
        // Get party-scoped effects from all sources
        const pending = this.getAllPendingEffectsForTrigger(type, partyContext);
        
        // Process each pending effect
        for (const p of pending) {
            this.processPendingEffect(p, partyContext);
        }
    }
    
    /**
     * Get party-scoped effect sources (equipment, consumables, tavern drinks).
     * Only returns effects with scope === 'party'.
     * @param {string} type - Trigger type
     * @param {object} context - Effect context
     * @returns {Array<{effect, source, sourceName, sourceType}>}
     */
    getAllPendingEffectsForTrigger(type, context) {
        const pending = [];
        
        // Equipment - party-scoped from all heroes
        for (const hero of this.all) {
            if (!hero.equipment) continue;
            const equipmentEffects = hero.equipment.getEffectsForTrigger(type, context);
            for (const { item, effect } of equipmentEffects) {
                if (effect.scope !== 'party') continue;
                pending.push({
                    effect,
                    source: item,
                    sourceName: `${hero.name}'s ${item.name}`,
                    sourceType: 'equipment'
                });
            }
        }
        
        // Consumables - party-scoped only
        if (this.manager.consumables) {
            const consumableEffects = this.manager.consumables.getEffectsForTrigger(type, context);
            for (const { consumable, effect } of consumableEffects) {
                if (effect.scope !== 'party') continue;
                pending.push({
                    effect,
                    source: consumable,
                    sourceName: consumable.name,
                    sourceType: 'consumable'
                });
            }
        }
        
        // Tavern drinks - party-scoped only
        if (this.manager.tavern) {
            const drinkEffects = this.manager.tavern.getEffectsForTrigger(type, context);
            for (const { drink, effect } of drinkEffects) {
                if (effect.scope !== 'party') continue;
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
     * Process a single party-scoped effect.
     * @param {object} pending - Pending effect object
     * @param {object} context - Effect context
     * @returns {boolean} Whether the effect was applied
     */
    processPendingEffect(pending, context) {
        const { effect, source, sourceName, sourceType } = pending;
        
        // Check condition if present
        if (effect.condition) {
            if (!evaluateCondition(effect.condition, context)) {
                return false;
            }
        }
        
        // Check limit if present
        if (!this.canEffectTrigger(effect, source)) {
            return false;
        }
        
        // Roll for chance
        const chance = effect.chance || 100;
        if (Math.random() * 100 > chance) {
            return false;
        }
        
        // Apply the effect to party
        this.applyPartyEffect(effect, source, sourceName, sourceType);
        
        // Record trigger for limit tracking
        this.recordEffectTrigger(effect, source);
        
        // Consume charge for consumables
        if (sourceType === 'consumable') {
            this.manager.consumables.removeCharges(source, 1);
            this.manager.log.add(`${sourceName} consumed a charge.`);
        }
        
        return true;
    }
    
    /**
     * Apply a party-scoped effect.
     * Handles target resolution for party-wide effects.
     * Note: This only applies to hero party. Uses new target/party format.
     */
    applyPartyEffect(effect, source, sourceName, sourceType) {
        const target = effect.target || 'all';
        const amount = effect.amount || 0;
        
        // Resolve targets within this party using convenience methods
        let targets = [];
        switch (target) {
            case 'all':
                targets = this.alive;
                break;
            case 'lowest':
                targets = this.lowestHp ? [this.lowestHp] : [];
                break;
            case 'front':
                targets = this.front && !this.front.dead ? [this.front] : [];
                break;
            case 'back':
                targets = this.back && !this.back.dead ? [this.back] : [];
                break;
            case 'random':
                targets = this.randomLiving ? [this.randomLiving] : [];
                break;
            default:
                targets = this.alive;
        }
        
        // Apply effect to targets
        for (const member of targets) {
            const builtEffect = createEffect(effect, { character: member, manager: this.manager });
            
            switch (effect.type) {
                case 'heal_flat':
                    member.heal({ amount: builtEffect.amount }, null);
                    this.manager.log.add(`${sourceName} heals ${member.name} for ${builtEffect.amount}`);
                    break;
                case 'heal_percent':
                    const healAmount = Math.ceil(member.maxHitpoints * (amount / 100));
                    member.heal({ amount: healAmount }, null);
                    this.manager.log.add(`${sourceName} heals ${member.name} for ${healAmount}`);
                    break;
                case 'buff':
                    const buffId = effect.id;
                    if (buffId) {
                        member.buff(buffId, builtEffect, null);
                        this.manager.log.add(`${sourceName} applies buff to ${member.name}`);
                    }
                    break;
                case 'debuff':
                    const debuffId = effect.id;
                    if (debuffId) {
                        member.debuff(debuffId, builtEffect, null);
                        this.manager.log.add(`${sourceName} applies debuff to ${member.name}`);
                    }
                    break;
                case 'damage_flat':
                    member.damage({ amount: builtEffect.amount }, null);
                    this.manager.log.add(`${sourceName} deals ${builtEffect.amount} damage to ${member.name}`);
                    break;
            }
        }
    }
    
    // =========================================================================
    // Effect Limit System (delegates to EffectLimitTracker)
    // =========================================================================
    
    canEffectTrigger(effect, source) {
        return this.effectLimitTracker.canTrigger(effect, source);
    }
    
    recordEffectTrigger(effect, source) {
        this.effectLimitTracker.record(effect, source);
    }
    
    resetEffectLimits(limitType) {
        this.effectLimitTracker.reset(limitType);
    }

    onLoad() {
        this.all.forEach(member => member.onLoad());
    }

    render() {
        this.back.render();
        this.center.render();
        this.front.render();
    }

    postDataRegistration() {
        
    }

    encode(writer) {
        this.back.encode(writer);
        this.center.encode(writer);
        this.front.encode(writer);
        return writer;
    }

    decode(reader, version) {
        this.back.decode(reader, version);
        this.center.decode(reader, version);
        this.front.decode(reader, version);
    }

    getErrorLog() {
        let log = `Party:\n`;
        this.all.forEach((member, i) => {
            log += `  [${i}] ${member.name}: HP=${member.hitpoints}/${member.maxHitpoints}, Energy=${member.energy}/${member.maxEnergy}, Dead=${member.dead}\n`;
        });
        return log;
    }
}

class AdventuringHeroParty extends AdventuringParty {
    constructor(manager, game) {
        super(manager, game);

        this.front = new AdventuringHero(this.manager, this.game, this);
        this.center = new AdventuringHero(this.manager, this.game, this);
        this.back = new AdventuringHero(this.manager, this.game, this);

        this.back.component.mount(this.component.party);
        this.center.component.mount(this.component.party);
        this.front.component.mount(this.component.party);
    }

    postDataRegistration() {
        super.postDataRegistration();
        this.all.forEach(member => member.postDataRegistration());
    }
}

class AdventuringEnemyParty extends AdventuringParty {
    constructor(manager, game) {
        super(manager, game);

        this.front = new AdventuringEnemy(this.manager, this.game, this);
        this.center = new AdventuringEnemy(this.manager, this.game, this);
        this.back = new AdventuringEnemy(this.manager, this.game, this);

        this.front.component.mount(this.component.party);
        this.center.component.mount(this.component.party);
        this.back.component.mount(this.component.party);
    }
}

export { AdventuringHeroParty, AdventuringEnemyParty }