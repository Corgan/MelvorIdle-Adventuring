const { loadModule } = mod.getContext(import.meta);

const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringAuras } = await loadModule('src/combat/adventuring-auras.mjs');
const { createEffect, EffectCache, defaultEffectProcessor, SimpleEffectInstance, evaluateCondition, buildEffectContext, StatCalculator } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringCharacterElement } = await loadModule('src/core/components/adventuring-character.mjs');

class AdventuringCharacterRenderQueue {
    constructor() {
        this.name = false;
        this.hitpoints = false;
        this.energy = false;
        this.stats = false;
        this.highlight = false;
        this.generator = false;
        this.spender = false;
        this.splash = false;
    }

    updateAll() {
        this.name = true;
        this.hitpoints = true;
        this.energy = true;
        this.stats = true;
        this.highlight = true;
        this.generator = true;
        this.spender = true;
        this.splash = true;
    }
}

class AdventuringCharacter {
    constructor(manager, game, party) {
        this.game = game;
        this.manager = manager;
        this.party = party;

        this.component = createElement('adventuring-character');
        this.component.setCharacter(this);

        this.card = new AdventuringCard(this.manager, this.game);

        this.hitpoints = 0;
        this.energy = 0;
        this.dead = false;
        this.highlight = false;

        this.auras = new AdventuringAuras(this.manager, this.game, this);
        this.auras.component.mount(this.component.auras);
        
        // Effect cache for this character
        this.effectCache = new EffectCache();
        
        // Effect trigger limit tracking
        // Maps effectKey -> triggerCount for each limit period
        this.effectTriggerCounts = {
            combat: new Map(),   // Reset at encounter_start
            round: new Map(),    // Reset at round_start
            turn: new Map()      // Reset at turn_start
        };

        this.stats = new AdventuringStats(this.manager, this.game);
        this.stats.component.mount(this.component.stats);
    }

    postDataRegistration() {

    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.hitpoints = true;
        this.renderQueue.energy = true;
        this.stats.renderQueue.stats = true;

        if(this.generator === undefined) // Default to None
            this.setGenerator(undefined);
        this.renderQueue.generator = true;
        
        if(this.spender === undefined) // Default to None
            this.setSpender(undefined);
        this.renderQueue.spender = true;

        this.auras.onLoad();
        
        // Initialize effect cache sources
        this.initEffectCache();
    }
    
    /**
     * Initialize effect cache with all effect sources for this character.
     * Override in subclasses to add additional sources (e.g., equipment for heroes).
     */
    initEffectCache() {
        // Register auras as an effect source
        this.effectCache.registerSource('auras', () => this.auras.getEffects());
        
        // Consumables apply to heroes - check in subclass
    }

    get maxHitpoints() {
        let max = 10 * this.stats.get("adventuring:hitpoints");
        return max;
    }

    get isHero() {
        return false;
    }

    get maxEnergy() {
        if(this.spender !== undefined && this.spender.cost > 0)
            return this.spender.cost;
        return 0;
    }

    get hitpointsPercent() {
        let pct = (Math.max(0, Math.min(this.maxHitpoints, this.hitpoints)) / this.maxHitpoints);
        return 100 * (!isNaN(pct) ? pct : 0);
    }

    get energyPercent() {
        let pct = (Math.max(0, Math.min(this.maxEnergy, this.energy)) / this.maxEnergy);
        return 100 * (!isNaN(pct) ? pct : 0);
    }
    
    // =========================================================================
    // Effect Limit System
    // =========================================================================
    
    /**
     * Generate a unique key for an effect to track its trigger count.
     * @param {object} effect - The effect object
     * @param {object} source - The source (item, consumable, etc.)
     * @returns {string} Unique key for this effect
     */
    getEffectKey(effect, source) {
        const sourceId = source?.id || source?.localID || 'unknown';
        const effectStr = JSON.stringify({
            type: effect.type,
            trigger: effect.trigger,
            id: effect.id,
            stat: effect.stat,
            amount: effect.amount
        });
        return `${sourceId}:${effectStr}`;
    }
    
    /**
     * Check if an effect can trigger based on its limit settings.
     * @param {object} effect - The effect with optional limit/times properties
     * @param {object} source - The source object for key generation
     * @returns {boolean} Whether the effect can trigger
     */
    canEffectTrigger(effect, source) {
        if (!effect.limit) return true; // No limit = always can trigger
        
        const key = this.getEffectKey(effect, source);
        const times = effect.times || 1;
        const countMap = this.effectTriggerCounts[effect.limit];
        
        if (!countMap) {
            console.warn(`Unknown limit type: ${effect.limit}`);
            return true;
        }
        
        const currentCount = countMap.get(key) || 0;
        return currentCount < times;
    }
    
    /**
     * Record that an effect has triggered (increment its count).
     * @param {object} effect - The effect that triggered
     * @param {object} source - The source object for key generation
     */
    recordEffectTrigger(effect, source) {
        if (!effect.limit) return; // No limit = don't track
        
        const key = this.getEffectKey(effect, source);
        const countMap = this.effectTriggerCounts[effect.limit];
        
        if (!countMap) return;
        
        const currentCount = countMap.get(key) || 0;
        countMap.set(key, currentCount + 1);
    }
    
    /**
     * Reset trigger counts for a specific limit period.
     * Called at encounter_start, round_start, turn_start.
     * @param {string} limitType - 'combat', 'round', or 'turn'
     */
    resetEffectLimits(limitType) {
        if (this.effectTriggerCounts[limitType]) {
            this.effectTriggerCounts[limitType].clear();
        }
    }
    
    // =========================================================================
    // Central Trigger Dispatcher
    // =========================================================================
    
    /**
     * Get all effect sources that respond to a trigger type.
     * Returns an array of pending effect objects that need processing.
     * Override in subclasses to add additional sources.
     * @param {string} type - Trigger type (e.g., 'after_damage_dealt', 'turn_start')
     * @param {object} context - Context built by buildEffectContext
     * @returns {Array<{effect: object, source: object, sourceName: string, sourceType: string}>}
     */
    getAllPendingEffectsForTrigger(type, context) {
        const pending = [];
        
        // Auras are a universal effect source for all characters
        if (this.auras) {
            const auraEffects = this.auras.getEffectsForTrigger(type, context);
            pending.push(...auraEffects);
        }
        
        return pending;
    }
    
    /**
     * Process a single pending effect from the trigger system.
     * Evaluates conditions, checks limits, rolls chance, and applies the effect.
     * Handles all effect types including aura-specific context modifiers.
     * @param {object} pending - Pending effect object from getAllPendingEffectsForTrigger
     * @param {object} context - Context built by buildEffectContext (mutated for middleware effects)
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
        
        // Check limit if present (now applies to auras too)
        if (!this.canEffectTrigger(effect, source)) {
            return false;
        }
        
        // Roll for chance-based effects
        const chance = effect.chance || 100;
        if (Math.random() * 100 > chance) {
            return false;
        }
        
        // Calculate effect amount with equipment scaling if applicable
        let amount = effect.amount || 0;
        if (sourceType === 'equipment' && effect.scaling && source.level > 0) {
            amount += Math.floor(source.level * effect.scaling);
        }
        
        // For aura effects, use the specialized aura processor
        if (sourceType === 'aura') {
            this.processAuraEffect(effect, source, sourceName, context);
        } else {
            // Apply the effect via standard processor
            this.processTriggeredEffect(effect, amount, context, sourceName);
        }
        
        // Record trigger for limit tracking
        this.recordEffectTrigger(effect, source);
        
        return true;
    }
    
    /**
     * Process an aura effect with instance context.
     * Handles context-modifying effects (reduce_amount, etc.) and self-modifying effects.
     * @param {object} effect - The effect with pre-resolved amount
     * @param {object} instance - The aura instance (for self-modifying effects)
     * @param {string} sourceName - Name for logging
     * @param {object} context - Context object (mutated for middleware effects)
     */
    processAuraEffect(effect, instance, sourceName, context) {
        const amount = effect.amount || 0;
        const stacks = effect.stacks || instance.stacks || 1;
        
        // Context-modifying effects (middleware pattern)
        switch (effect.type) {
            case 'skip':
                context.skip = true;
                return;
                
            case 'reduce_amount': {
                const reduce = Math.min(context.amount || 0, amount * stacks);
                context.amount = (context.amount || 0) - reduce;
                if (effect.consume !== false && instance.remove_stacks) {
                    instance.remove_stacks(reduce);
                }
                return;
            }
            
            case 'reduce_damage_percent': {
                const reduction = Math.ceil((context.amount || 0) * (amount / 100));
                context.amount = Math.max(0, (context.amount || 0) - reduction);
                return;
            }
            
            case 'absorb_damage': {
                const amountPerStack = amount || 1;
                const totalAbsorb = amountPerStack * stacks;
                const damage = context.amount || 0;
                const absorbed = Math.min(damage, totalAbsorb);
                context.amount = damage - absorbed;
                if (effect.consume !== false && absorbed > 0 && instance.remove_stacks) {
                    const stacksToRemove = Math.ceil(absorbed / amountPerStack);
                    instance.remove_stacks(stacksToRemove);
                }
                if (absorbed > 0) {
                    this.manager.log.add(`${this.name}'s ${sourceName} absorbs ${absorbed} damage`);
                }
                return;
            }
            
            case 'chance_skip':
                if (Math.random() * 100 < amount) {
                    context.skip = true;
                    this.manager.log.add(`${this.name} is overcome with ${sourceName}!`);
                }
                return;
                
            case 'chance_dodge':
                if (Math.random() * 100 < amount) {
                    context.amount = 0;
                    context.dodged = true;
                    this.manager.log.add(`${this.name} dodges the attack!`);
                }
                return;
                
            case 'chance_miss':
                if (Math.random() * 100 < amount) {
                    context.amount = 0;
                    context.missed = true;
                    this.manager.log.add(`${this.name} misses due to ${sourceName}!`);
                }
                return;
                
            case 'evade':
                context.amount = 0;
                context.evaded = true;
                if (effect.consume !== false && instance.remove_stacks) {
                    instance.remove_stacks(1);
                }
                this.manager.log.add(`${this.name} evades the attack with ${sourceName}!`);
                return;
                
            case 'untargetable':
                context.untargetable = true;
                return;
                
            case 'prevent_debuff':
                context.prevented = true;
                this.manager.log.add(`${this.name}'s ${sourceName} prevents the debuff!`);
                return;
                
            case 'prevent_ability':
                context.prevented = true;
                return;
                
            case 'prevent_death':
                if (effect.oncePerEncounter && instance._preventDeathUsed) {
                    return;
                }
                context.prevented = true;
                // Pass through heal amount for death prevention healing (whole number percent)
                context.preventDeathHealAmount = effect.amount || 0;
                if (effect.oncePerEncounter) {
                    instance._preventDeathUsed = true;
                }
                this.manager.log.add(`${this.name}'s ${sourceName} prevents death!`);
                return;
                
            case 'prevent_lethal': {
                const currentHP = this.hitpoints;
                const incomingDamage = context.amount || 0;
                if (currentHP - incomingDamage <= 0 && currentHP > 0) {
                    context.amount = currentHP - 1;
                    context.preventedLethal = true;
                    this.manager.log.add(`${this.name}'s ${sourceName} prevents lethal damage!`);
                }
                return;
            }
            
            case 'force_target':
                if (instance.source) {
                    context.forcedTarget = instance.source;
                }
                return;
                
            case 'flat_damage':
                context.amount = (context.amount || 0) + amount;
                return;
                
            case 'increase_damage_percent': {
                const increase = Math.ceil((context.amount || 0) * (amount / 100));
                context.amount = (context.amount || 0) + increase;
                return;
            }
        }
        
        // Self-modifying effects (cleanup)
        switch (effect.type) {
            case 'remove_stacks': {
                let count = effect.count || 1;
                if (count < 1) {
                    count = Math.ceil(stacks * count);
                }
                if (instance.remove_stacks) instance.remove_stacks(count);
                return;
            }
            
            case 'remove':
                if (effect.age !== undefined) {
                    if (instance.age >= effect.age && instance.remove) {
                        instance.remove();
                    }
                } else if (instance.remove) {
                    instance.remove();
                }
                return;
        }
        
        // Apply effects (damage, heal, buff, debuff, etc.)
        const builtEffect = { amount, stacks };
        
        switch (effect.type) {
            case 'damage_flat':
            case 'damage': {
                const target = effect.target || 'self';
                let targetChar = this.resolveEffectTarget(target, context);
                if (targetChar && !targetChar.dead) {
                    targetChar.damage(builtEffect, this);
                    this.manager.log.add(`${this.name}'s ${sourceName} deals ${amount} damage to ${targetChar.name}`);
                }
                return;
            }
            
            case 'heal_flat':
            case 'heal': {
                const target = effect.target || 'self';
                let targetChar = this.resolveEffectTarget(target, context);
                if (targetChar && !targetChar.dead) {
                    targetChar.heal(builtEffect, this);
                    this.manager.log.add(`${this.name}'s ${sourceName} heals ${targetChar.name} for ${amount}`);
                }
                return;
            }
            
            case 'heal_percent': {
                const healAmount = Math.ceil(this.maxHitpoints * (amount / 100));
                this.heal({ amount: healAmount }, this);
                this.manager.log.add(`${this.name} heals for ${healAmount} from ${sourceName}`);
                return;
            }
            
            case 'buff': {
                const auraId = effect.id;
                if (!auraId) return;
                const target = effect.target || 'self';
                let targetChar = this.resolveEffectTarget(target, context);
                if (targetChar && !targetChar.dead) {
                    targetChar.buff(auraId, { stacks }, this);
                    this.manager.log.add(`${this.name}'s ${sourceName} applies buff to ${targetChar.name}`);
                }
                return;
            }
            
            case 'debuff': {
                const auraId = effect.id;
                if (!auraId) return;
                const target = effect.target || 'target';
                let targetChar = this.resolveEffectTarget(target, context);
                if (targetChar && !targetChar.dead) {
                    targetChar.debuff(auraId, { stacks }, this);
                    this.manager.log.add(`${this.name}'s ${sourceName} applies debuff to ${targetChar.name}`);
                }
                return;
            }
            
            case 'energy':
                this.energy = Math.min(this.maxEnergy, this.energy + amount);
                this.renderQueue.energy = true;
                return;
                
            case 'lifesteal': {
                const healAmount = Math.ceil((context.damageDealt || 0) * (amount / 100));
                if (healAmount > 0) {
                    this.heal({ amount: healAmount }, this);
                    this.manager.log.add(`${this.name} heals for ${healAmount} from ${sourceName}`);
                }
                return;
            }
            
            case 'reflect_damage': {
                if (context.damageReceived && context.attacker) {
                    const reflectAmount = Math.ceil(context.damageReceived * (amount / 100));
                    context.attacker.damage({ amount: reflectAmount }, this);
                    this.manager.log.add(`${this.name}'s ${sourceName} reflects ${reflectAmount} damage`);
                }
                return;
            }
            
            case 'cleanse': {
                const count = amount || effect.count || 999;
                const target = effect.target === 'self' || !effect.target ? this : 
                              (effect.target === 'attacker' ? context.attacker : context.target);
                if (target && !target.dead && target.auras) {
                    let removed = 0;
                    for (const auraInstance of [...target.auras.auras.values()]) {
                        if (auraInstance.base && auraInstance.base.isDebuff && removed < count) {
                            auraInstance.stacks = 0;
                            removed++;
                        }
                    }
                    if (removed > 0) {
                        target.auras.cleanAuras();
                        target.auras.renderQueue.auras = true;
                        if (target.effectCache) target.invalidateEffects('auras');
                        this.manager.log.add(`${this.name}'s ${sourceName} cleanses ${removed} debuff(s) from ${target.name}`);
                    }
                }
                return;
            }
            
            case 'random_buffs': {
                const buffPool = [
                    'adventuring:might', 'adventuring:fortify', 'adventuring:haste',
                    'adventuring:regeneration', 'adventuring:barrier', 'adventuring:focus',
                    'adventuring:arcane_power', 'adventuring:stealth'
                ];
                const count = effect.count || 1;
                for (let i = 0; i < count; i++) {
                    const buffId = buffPool[Math.floor(Math.random() * buffPool.length)];
                    this.auras.add(buffId, { stacks }, this);
                }
                this.manager.log.add(`${this.name}'s ${sourceName} grants ${count} random buffs`);
                return;
            }
            
            case 'random_debuffs': {
                const debuffPool = [
                    'adventuring:weaken', 'adventuring:slow', 'adventuring:blind',
                    'adventuring:poison', 'adventuring:burn', 'adventuring:decay',
                    'adventuring:vulnerability', 'adventuring:chill'
                ];
                const count = effect.count || 1;
                const target = effect.target === 'attacker' ? context.attacker : context.target;
                if (target && !target.dead) {
                    for (let i = 0; i < count; i++) {
                        const debuffId = debuffPool[Math.floor(Math.random() * debuffPool.length)];
                        target.auras.add(debuffId, { stacks }, this);
                    }
                    this.manager.log.add(`${this.name}'s ${sourceName} applies ${count} random debuffs to ${target.name}`);
                }
                return;
            }
            
            case 'dispel_buff': {
                const count = effect.count || 1;
                const target = effect.target === 'self' ? this : 
                              (effect.target === 'attacker' ? context.attacker : context.target);
                if (target && !target.dead && target.auras) {
                    let removed = 0;
                    for (const auraInstance of [...target.auras.auras.values()]) {
                        if (auraInstance.base && !auraInstance.base.isDebuff && removed < count) {
                            auraInstance.stacks = 0;
                            removed++;
                        }
                    }
                    if (removed > 0) {
                        target.auras.cleanAuras();
                        target.auras.renderQueue.auras = true;
                        if (target.effectCache) target.invalidateEffects('auras');
                        this.manager.log.add(`${this.name}'s ${sourceName} dispels ${removed} buff(s) from ${target.name}`);
                    }
                }
                return;
            }
        }
        
        // Stat-related effects are passive and don't need runtime processing
    }
    
    /**
     * Resolve a target string to a character.
     * @param {string} target - Target type
     * @param {object} context - Context with attacker, target references
     * @returns {object|null} Target character or null
     */
    resolveEffectTarget(target, context) {
        switch (target) {
            case 'self':
            case undefined:
                return this;
            case 'attacker':
                return context.attacker || null;
            case 'target':
                return context.target || null;
            default:
                return this;
        }
    }

    get action() {
        if(this.spender.cost !== undefined && this.energy >= this.spender.cost) {
            // Check for Silence (prevent_ability) before allowing spender
            let silenceCheck = this.trigger('before_spender_cast', {});
            if(!silenceCheck.prevented) {
                return this.spender;
            }
            // Silenced - use generator instead
        }
        return this.generator;
    }

    setGenerator(generator) {
        if(generator === undefined)
            generator = this.manager.generators.getObjectByID('adventuring:none');

        this.generator = generator;
        this.renderQueue.generator = true;
    }

    setSpender(spender) {
        if(spender === undefined)
            spender = this.manager.spenders.getObjectByID('adventuring:none');

        this.spender = spender;
        this.renderQueue.spender = true;
        this.renderQueue.energy = true;
    }

    trigger(type, extra={}) {
        // Build unified context for this trigger
        const context = buildEffectContext(this, extra);
        
        // Get pending effects from all registered sources (including auras)
        const pending = this.getAllPendingEffectsForTrigger(type, context);
        
        // Process all pending effects through unified processor
        for (const p of pending) {
            this.processPendingEffect(p, context);
        }
        
        // Return the modified context for caller use
        return context;
    }

    applyEffect(effect, builtEffect, character) {
        if(effect.type === "damage" || effect.type === "damage_flat")
            this.damage(builtEffect, character);
        if(effect.type === "heal" || effect.type === "heal_flat")
            this.heal(builtEffect, character);
        if(effect.type === "revive")
            this.revive(builtEffect, character);
        if(effect.type === "buff") {
            const auraId = effect.id;
            if(auraId) this.buff(auraId, builtEffect, character);
        }
        if(effect.type === "debuff") {
            const auraId = effect.id;
            if(auraId) this.debuff(auraId, builtEffect, character);
        }
    }

    /**
     * Process a triggered effect (from equipment, consumables, etc.)
     * Uses the unified defaultEffectProcessor for consistent handling.
     * @param {object} effect - The effect to process
     * @param {number} amount - Calculated effect amount
     * @param {object} extra - Extra context (attacker, target, damageDealt, etc.)
     * @param {string} sourceName - Name of the source for logging
     * @returns {object} Modified extra object
     */
    processTriggeredEffect(effect, amount, extra, sourceName) {
        // Use the unified processor with a simple instance wrapper
        const context = {
            character: this,
            manager: this.manager,
            extra: extra
        };
        
        return defaultEffectProcessor.processSimple(effect, amount, sourceName, context);
    }

    buff(id, builtEffect, character) {
        if(this.dead)
            return;
        this.auras.add(id, builtEffect, character);
    }

    debuff(id, builtEffect, character) {
        if(this.dead)
            return;
        
        // Check for Immunity (prevent_debuff)
        let immunityCheck = this.trigger('before_debuff_received', {});
        if(immunityCheck.prevented) {
            return; // Debuff blocked by immunity
        }
        
        this.auras.add(id, builtEffect, character);
    }

    // Check if character can be targeted by enemies
    isUntargetable() {
        let result = this.trigger('targeting', { untargetable: false });
        return result.untargetable === true;
    }

    /**
     * Get all effects affecting this character from all sources.
     * Uses the EffectCache for performance.
     * @param {string} [trigger] - Optional filter by trigger type
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getAllEffects(trigger = null) {
        return this.effectCache.getEffects(trigger);
    }
    
    /**
     * Get a passive bonus value by effect type.
     * Sums all passive effects of the given type.
     * @param {string} effectType - Effect type (e.g., 'increase_xp_percent', 'increase_drop_rate_percent')
     * @returns {number} Total bonus value
     */
    getPassiveBonus(effectType) {
        return this.effectCache.getBonus(effectType);
    }
    
    /**
     * Get computed stat bonuses from all passive effects.
     * @param {string} statId - Stat ID to query
     * @returns {{ flat: number, percent: number }} Flat and percent bonuses
     */
    getStatBonus(statId) {
        return this.effectCache.getStatBonus(statId);
    }
    
    /**
     * Invalidate effect cache for a specific source.
     * Call this when a source changes (e.g., equipment equipped, aura applied).
     * @param {string} sourceId - Source that changed
     */
    invalidateEffects(sourceId) {
        this.effectCache.invalidate(sourceId);
    }

    /**
     * Get effective stat value with all modifiers applied.
     * Queries all effect sources for passive stat effects.
     * Uses StatCalculator: base + flat → percent → all_stat_bonus.
     */
    getEffectiveStat(stat) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        
        return StatCalculator.calculate(
            this.stats.get(stat),
            this.getStatBonus(stat.id),
            this.getPassiveBonus('all_stat_bonus')
        );
    }

    damage({ amount }, character) {
        if(this.dead)
            return;
        
        this.hitpoints -= amount;

        if(isNaN(this.hitpoints))
            this.hitpoints = 0;

        // Track damage dealt for achievements (if attacker is hero dealing to enemy)
        if(character && character.isHero && !this.isHero && this.manager.achievements) {
            const stats = this.manager.achievementManager.stats;
            if(stats) {
                stats.totalDamage = (stats.totalDamage || 0) + amount;
            }
        }
        
        // Equipment gains mastery XP from damage dealt (attacker's equipment)
        if(character && character.isHero && !this.isHero && amount > 0) {
            // Calculate XP based on damage dealt (balanced to match job XP progression)
            const equipmentXP = Math.max(1, Math.floor(amount / 5));
            
            character.equipment?.slots?.forEach((equipmentSlot, slotType) => {
                if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                    equipmentSlot.item.addXP(equipmentXP);
                }
            });
        }
        
        // Equipment gains mastery XP from damage taken (defender's equipment, heroes only)
        // This allows tanks to level their gear through surviving hits
        if(this.isHero && !character?.isHero && amount > 0 && !this.dead) {
            // Calculate XP based on damage taken (same rate as damage dealt)
            const equipmentXP = Math.max(1, Math.floor(amount / 5));
            
            this.equipment?.slots?.forEach((equipmentSlot, slotType) => {
                if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                    equipmentSlot.item.addXP(equipmentXP);
                }
            });
        }

        if(!loadingOfflineProgress) {
            this.component.splash.add({
                source: 'Attack',
                amount: -amount,
                xOffset: this.hitpointsPercent,
            });
        }

        if(this.hitpoints <= 0) {
            this.hitpoints = 0;
            this.setEnergy(0);
            if(!this.dead) {
                // Check for prevent_death effects
                let preventCheck = this.trigger('before_death', { prevented: false, preventDeathHealAmount: 0 });
                if(preventCheck.prevented) {
                    // Death was prevented - heal based on amount (whole number percent) or default to 1 HP
                    const healPct = preventCheck.preventDeathHealAmount || 0;
                    if(healPct > 0) {
                        this.hitpoints = Math.max(1, Math.floor(this.maxHitpoints * (healPct / 100)));
                    } else {
                        this.hitpoints = 1;
                    }
                    this.manager.log.add(`${this.name} cheated death!`);
                    this.renderQueue.hitpoints = true;
                    return;
                }
                
                this.dead = true;

                this.onDeath();

                let resolvedEffects = this.trigger('death');
            }
        } else {
            // Damage triggers are now handled via the unified trigger system
            // see `after_damage_received` trigger in encounter
        }
        this.renderQueue.hitpoints = true;
    }

    heal({ amount }, character) {
        if(this.dead || this.hitpoints === this.maxHitpoints)
            return;

        const actualHeal = Math.min(amount, this.maxHitpoints - this.hitpoints);
        this.hitpoints += amount;
        
        if(isNaN(this.hitpoints))
            this.hitpoints = 0;

        // Track healing for achievements (if this is a hero being healed)
        if(this.isHero && this.manager.achievements && actualHeal > 0) {
            const stats = this.manager.achievementManager.stats;
            if(stats) {
                stats.totalHealing = (stats.totalHealing || 0) + actualHeal;
            }
        }
        
        // Equipment gains mastery XP from healing done (healer's equipment)
        // Healing is less frequent and smaller amounts than damage, so use higher rate
        if(character && character.isHero && actualHeal > 0) {
            // Calculate XP based on healing done (2x rate of damage since heals are less frequent)
            const equipmentXP = Math.max(1, Math.floor(actualHeal / 5));
            
            character.equipment?.slots?.forEach((equipmentSlot, slotType) => {
                if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                    equipmentSlot.item.addXP(equipmentXP);
                }
            });
        }
        
        // Equipment gains mastery XP from being healed (target's equipment)
        // This helps support roles level their gear
        if(this.isHero && character && character.isHero && actualHeal > 0) {
            // Calculate XP based on healing received (same rate as damage taken)
            const equipmentXP = Math.max(1, Math.floor(actualHeal / 5));
            
            this.equipment?.slots?.forEach((equipmentSlot, slotType) => {
                if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                    equipmentSlot.item.addXP(equipmentXP);
                }
            });
        }

        if(!loadingOfflineProgress) {
            this.component.splash.add({
                source: 'Heal',
                amount: amount,
                xOffset: this.hitpointsPercent,
            });
        }

        if(this.hitpoints >= this.maxHitpoints)
            this.hitpoints = this.maxHitpoints;
        
        this.renderQueue.hitpoints = true;
    }

    revive({ amount=100 }, character) {
        if(!this.dead)
            return;

        this.dead = false;
        // amount is whole percent (50 = 50% HP)
        this.hitpoints = Math.floor(this.maxHitpoints * amount / 100);
        
        if(isNaN(this.hitpoints))
            this.hitpoints = this.maxHitpoints;
            
        this.setEnergy(0);
        this.renderQueue.hitpoints = true;
    }

    addEnergy(amount) {
        this.energy += amount;
        if(this.energy > this.maxEnergy)
            this.energy = this.maxEnergy;
        this.renderQueue.energy = true;
    }

    removeEnergy(amount) {
        this.energy -= amount;
        if(this.energy < 0)
            this.energy = 0;
        this.renderQueue.energy = true;
    }

    setEnergy(amount) {
        this.energy = amount;
        if(this.energy > this.maxEnergy)
            this.energy = this.maxEnergy;
        if(this.energy < 0)
            this.energy = 0;
        this.renderQueue.energy = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;

        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    onDeath() {
        this.manager.log.add(`${this.name} dies`);
    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderHighlight();
        this.renderHitpoints();
        this.renderSplash();
        this.renderEnergy();
        this.auras.render();
        this.stats.render();
        this.renderGenerator();
        this.renderSpender();
        this.card.render();
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

        this.component.icon.classList.remove('d-none');
        this.component.icon.firstElementChild.src = this.media;
        this.card.icon = this.media;
        this.card.renderQueue.icon = true;

        this.renderQueue.icon = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

//        this.component.styling.classList.toggle('bg-combat-menu-selected', this.highlight);

        this.renderQueue.highlight = false;
    }

    renderSplash() {
        if(this.component.splash.queue.length === 0)
            return;
        
        this.component.splash.render();
    }

    renderHitpoints() {
        if(!this.renderQueue.hitpoints)
            return;
        
        this.component.hitpoints.textContent = this.hitpoints;
        this.component.maxHitpoints.textContent = this.maxHitpoints;
        if(this.component.hitpointsProgress.currentStyle !== 'bg-success') {
            this.component.hitpointsProgress.outerBar.classList.add('bg-danger')
            this.component.hitpointsProgress.setStyle('bg-success');
        }
        this.component.hitpointsProgress.setFixedPosition(this.hitpointsPercent);

        this.renderQueue.hitpoints = false;
    }

    renderEnergy() {
        if(!this.renderQueue.energy)
            return;
        
        this.component.energy.parentElement.classList.toggle('invisible', this.maxEnergy === 0);
        this.component.energyProgress.classList.toggle('invisible', this.maxEnergy === 0);
        
        this.component.energy.textContent = this.energy;
        this.component.maxEnergy.textContent = this.maxEnergy;

        if(this.component.hitpointsProgress.currentStyle !== 'bg-info')
            this.component.energyProgress.setStyle('bg-info');
        this.component.energyProgress.setFixedPosition(this.energyPercent);

        this.renderQueue.energy = false;
    }

    renderGenerator() {
        if(!this.renderQueue.generator)
            return;

        this.component.generator.nameText.textContent = this.generator.name;
        this.component.generator.setTooltipContent(this.component.generator.buildAbilityTooltip(this.generator));
        this.component.generator.styling.classList.toggle('bg-combat-menu-selected', this.generator === this.action && this.highlight);

        this.renderQueue.generator = false;
    }

    renderSpender() {
        if(!this.renderQueue.spender)
            return;

        this.component.spender.nameText.textContent = this.spender.name;
        this.component.spender.setTooltipContent(this.component.spender.buildAbilityTooltip(this.spender));
        this.component.spender.styling.classList.toggle('bg-combat-menu-selected', this.spender === this.action && this.highlight);

        this.renderQueue.spender = false;
    }

    postDataRegistration() {

    }

    encode(writer) {
        writer.writeBoolean(this.dead);
        writer.writeUint32(this.hitpoints);
        writer.writeUint32(this.energy);
        writer.writeNamespacedObject(this.generator);
        writer.writeNamespacedObject(this.spender);

        this.auras.encode(writer);
        return writer;
    }

    decode(reader, version) {
        this.dead = reader.getBoolean();
        this.hitpoints = reader.getUint32();
        this.energy = reader.getUint32();

        const generator = reader.getNamespacedObject(this.manager.generators);
        if (typeof generator === 'string')
            this.setGenerator(undefined);
        else
            this.setGenerator(generator);

        const spender = reader.getNamespacedObject(this.manager.spenders);
        if (typeof spender === 'string')
            this.setSpender(undefined);
        else
            this.setSpender(spender);
        
        this.auras.decode(reader, version);
    }
}

export { AdventuringCharacter, AdventuringCharacterRenderQueue };