const { loadModule } = mod.getContext(import.meta);

const { AdventuringHero } = await loadModule('src/entities/adventuring-hero.mjs');
const { AdventuringEnemy } = await loadModule('src/entities/adventuring-enemy.mjs');
const { AdventuringPartyElement } = await loadModule('src/entities/components/adventuring-party.mjs');
const { evaluateCondition, buildEffectContext, createEffect } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringParty {
    constructor(manager, game) {
        this.game = game;
        this.manager = manager;
        
        this.component = createElement('adventuring-party');
        
        // Effect trigger limit tracking for party-scoped effects
        this.effectTriggerCounts = {
            combat: new Map(),
            round: new Map(),
            turn: new Map()
        };
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
     */
    applyPartyEffect(effect, source, sourceName, sourceType) {
        const target = effect.target || 'all_allies';
        const amount = effect.amount || 0;
        
        // Resolve targets
        let targets = [];
        switch (target) {
            case 'all_allies':
            case 'party':
            case 'all':
                targets = this.alive;
                break;
            case 'lowest':
                targets = this.alive.length > 0 
                    ? [this.alive.reduce((low, m) => m.hitpoints < low.hitpoints ? m : low)]
                    : [];
                break;
            case 'front':
                targets = this.front && !this.front.dead ? [this.front] : [];
                break;
            case 'back':
                targets = this.back && !this.back.dead ? [this.back] : [];
                break;
            case 'random':
                targets = this.alive.length > 0 
                    ? [this.alive[Math.floor(Math.random() * this.alive.length)]]
                    : [];
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
                    const buffId = effect.id || effect.buff;
                    if (buffId) {
                        member.buff(buffId, builtEffect, null);
                        this.manager.log.add(`${sourceName} applies buff to ${member.name}`);
                    }
                    break;
                case 'debuff':
                    const debuffId = effect.id || effect.debuff;
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
    // Effect Limit System (same as character)
    // =========================================================================
    
    getEffectKey(effect, source) {
        const sourceId = source?.id || source?.localID || 'unknown';
        const effectStr = JSON.stringify({
            type: effect.type,
            trigger: effect.trigger,
            id: effect.id,
            amount: effect.amount
        });
        return `${sourceId}:${effectStr}`;
    }
    
    canEffectTrigger(effect, source) {
        if (!effect.limit) return true;
        
        const key = this.getEffectKey(effect, source);
        const times = effect.times || 1;
        const countMap = this.effectTriggerCounts[effect.limit];
        
        if (!countMap) return true;
        
        const currentCount = countMap.get(key) || 0;
        return currentCount < times;
    }
    
    recordEffectTrigger(effect, source) {
        if (!effect.limit) return;
        
        const key = this.getEffectKey(effect, source);
        const countMap = this.effectTriggerCounts[effect.limit];
        
        if (!countMap) return;
        
        const currentCount = countMap.get(key) || 0;
        countMap.set(key, currentCount + 1);
    }
    
    resetEffectLimits(limitType) {
        if (this.effectTriggerCounts[limitType]) {
            this.effectTriggerCounts[limitType].clear();
        }
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