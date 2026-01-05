const { loadModule } = mod.getContext(import.meta);

const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringAuras } = await loadModule('src/combat/adventuring-auras.mjs');
const { createEffect, EffectCache, defaultEffectProcessor, SimpleEffectInstance } = await loadModule('src/core/adventuring-utils.mjs');

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
        const resolvedEffects = this.auras.trigger(type);
        
        // Use the centralized effect processor
        return defaultEffectProcessor.processAll(resolvedEffects, {
            character: this,
            manager: this.manager,
            extra
        });
    }

    applyEffect(effect, builtEffect, character) {
        if(effect.type === "damage")
            this.damage(builtEffect, character);
        if(effect.type === "heal")
            this.heal(builtEffect, character);
        if(effect.type === "revive")
            this.revive(builtEffect, character);
        if(effect.type === "buff") {
            const auraId = effect.buff || effect.id;
            if(auraId) this.buff(auraId, builtEffect, character);
        }
        if(effect.type === "debuff") {
            const auraId = effect.debuff || effect.buff || effect.id;
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
     * Applies flat bonuses first, then percent bonuses, then all_stat_bonus.
     */
    getEffectiveStat(stat) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        
        let baseValue = this.stats.get(stat);
        
        // Use cached stat bonus calculation
        const bonus = this.getStatBonus(stat.id);
        
        // Get all_stat_bonus (applies to all stats)
        const allStatBonus = this.getPassiveBonus('all_stat_bonus');
        
        // Apply flat bonuses to base, then percent modifier, then all_stat_bonus
        const withFlat = baseValue + bonus.flat;
        const withPercent = withFlat * (1 + bonus.percent / 100);
        const withAllBonus = withPercent * (1 + allStatBonus / 100);
        
        return Math.floor(withAllBonus);
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
            // Calculate XP based on damage dealt (scaled down to reasonable rate)
            const equipmentXP = Math.max(1, Math.floor(amount / 10));
            
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
            const equipmentXP = Math.max(1, Math.floor(amount / 10));
            
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
                let preventCheck = this.trigger('before_death', { prevented: false });
                if(preventCheck.prevented) {
                    // Death was prevented - restore to 1 HP
                    this.hitpoints = 1;
                    this.manager.log.add(`${this.name} cheated death!`);
                    this.renderQueue.hitpoints = true;
                    return;
                }
                
                this.dead = true;

                this.onDeath();

                let resolvedEffects = this.trigger('death');
            }
        } else {
            // Check for consumable heal triggers (only for heroes, not enemies)
            if(this.isHero && this.manager.consumables) {
                this.manager.consumables.onCharacterDamaged(this);
            }
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
            const equipmentXP = Math.max(1, Math.floor(actualHeal / 10));
            
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