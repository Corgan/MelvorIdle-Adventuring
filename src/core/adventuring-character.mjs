const { loadModule } = mod.getContext(import.meta);

const { AdventuringCard } = await loadModule('src/ui/adventuring-card.mjs');
const { AdventuringStats } = await loadModule('src/core/stats/adventuring-stats.mjs');
const { AdventuringAuras } = await loadModule('src/combat/adventuring-auras.mjs');
const { StatCalculator } = await loadModule('src/core/stats/stat-calculator.mjs');
const { EffectLimitTracker } = await loadModule('src/core/effects/effect-limit-tracker.mjs');
const { EffectCache } = await loadModule('src/core/effects/effect-cache.mjs');
const { evaluateCondition } = await loadModule('src/core/effects/condition-evaluator.mjs');
const { createEffect, defaultEffectProcessor, SimpleEffectInstance, buildEffectContext, awardCombatXP } = await loadModule('src/core/utils/adventuring-utils.mjs');

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

        this.effectCache = new EffectCache();

        this.effectLimitTracker = new EffectLimitTracker();

        this.stats = new AdventuringStats(this.manager, this.game);
        this.stats.setOwner(this);
        this.stats.component.mount(this.component.stats);
    }

    // Required by base class contract - no additional registration needed
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

        this.initEffectCache();
        
        // Register this character as an entity with the conductor
        this.manager.conductor.registerEntity(this, (type, context) => this._handleTrigger(type, context));
    }

    initEffectCache() {

        this.effectCache.registerSource('auras', () => this.auras.getEffects());

    }

    get maxHitpoints() {
        // Use getEffectiveStat to include all stat sources (base, job effects, equipment, buffs)
        const hitpointsStat = this.manager?.stats?.getObjectByID("adventuring:hitpoints");
        if (!hitpointsStat) {
            // Fallback for cases where manager isn't ready
            return 10 * (this.stats.get("adventuring:hitpoints") || 0);
        }
        let max = 10 * this.getEffectiveStat(hitpointsStat);
        return max;
    }

    get isHero() {
        return false;
    }

    /**
     * Get this character's position in their party.
     * @param {boolean} short - If true, returns short form (F/C/B), otherwise full (Front/Center/Back)
     * @returns {string|null} The position label, or null if not in a party
     */
    getPosition(short = false) {
        if (!this.party) return null;
        if (this === this.party.front) return short ? 'F' : 'Front';
        if (this === this.party.center) return short ? 'C' : 'Center';
        if (this === this.party.back) return short ? 'B' : 'Back';
        return null;
    }

    /**
     * Get this character's name for display, adding position if there are duplicate names in the party.
     * @param {boolean} short - If true, uses short position form (F/C/B)
     * @returns {string} The name, optionally with position suffix like "Goblin (Front)" or "Goblin (F)"
     */
    getDisplayName(short = false) {
        if (!this.party) return this.name;
        
        // Count how many party members have the same name
        const sameNameCount = this.party.all.filter(m => m.name === this.name).length;
        
        if (sameNameCount > 1) {
            const position = this.getPosition(short);
            return position ? `${this.name} (${position})` : this.name;
        }
        
        return this.name;
    }

    /**
     * Get a party by type relative to this character's perspective.
     * @param {'ally'|'enemy'} type - Which party to get
     * @returns {Party} The requested party
     */
    getParty(type) {
        // Base implementation - subclasses override
        return null;
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

    canEffectTrigger(effect, source) {
        return this.effectLimitTracker.canTrigger(effect, source);
    }

    recordEffectTrigger(effect, source) {
        this.effectLimitTracker.record(effect, source);
    }

    resetEffectLimits(...limitTypes) {
        for (const limitType of limitTypes) {
            this.effectLimitTracker.reset(limitType);
        }
    }

    get action() {
        if(this.spender.cost !== undefined && this.energy >= this.spender.cost) {

            let silenceCheck = this.trigger('before_spender_cast', {});
            if(!silenceCheck.prevented) {
                return this.spender;
            }

        }
        return this.generator;
    }

    setGenerator(generator) {
        if(generator === undefined)
            generator = this.manager.generators.getObjectByID('adventuring:none_generator');

        this.generator = generator;
        this.renderQueue.generator = true;
    }

    setSpender(spender) {
        if(spender === undefined)
            spender = this.manager.spenders.getObjectByID('adventuring:none_spender');

        this.spender = spender;
        this.renderQueue.spender = true;
        this.renderQueue.energy = true;
    }

    /**
     * Fire a trigger via the conductor.
     * @param {string} type - The trigger type
     * @param {object} extra - Additional context (source will be set to this character)
     * @returns {object} The built context
     */
    trigger(type, extra={}) {
        const context = buildEffectContext(this, extra);
        this.manager.conductor.trigger(type, { ...context, source: this });
        return context;
    }

    /**
     * Handler called by conductor when this character should process a trigger.
     * @param {string} type - The trigger type
     * @param {object} context - Full context from conductor
     */
    _handleTrigger(type, context) {
        // Dead characters don't trigger effects
        if (this.isDead) return;
        
        this.effectCache.processTrigger(type, context, {
            host: this,
            limitTracker: this.effectLimitTracker
        });
    }

    applyEffect(effect, builtEffect, character) {
        let effectiveAmount = 0;
        if(effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current")
            effectiveAmount = this.damage(builtEffect, character) || 0;
        if(effect.type === "heal" || effect.type === "heal_flat")
            effectiveAmount = this.heal(builtEffect, character) || 0;
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
        return effectiveAmount;
    }

    buff(id, builtEffect, character) {
        if(this.dead)
            return;
        this.auras.add(id, builtEffect, character);
        // Fire buff_applied trigger (only for heroes, not enemies)
        if (this.isHero) {
            this.manager.conductor.trigger('buff_applied', { target: this, buffId: id });
        }
    }

    debuff(id, builtEffect, character) {
        if(this.dead)
            return;

        let immunityCheck = this.trigger('before_debuff_received', {});
        if(immunityCheck.prevented) {
            return; // Debuff blocked by immunity
        }

        this.auras.add(id, builtEffect, character);
        // Fire debuff_applied trigger (only for debuffs on enemies, not heroes)
        if (!this.isHero) {
            this.manager.conductor.trigger('debuff_applied', { target: this, debuffId: id });
        }
    }

    isUntargetable() {
        let result = this.trigger('targeting', { untargetable: false });
        return result.untargetable === true;
    }

    getAllEffects(trigger = null) {
        return this.effectCache.getEffects(trigger);
    }

    getPassiveBonus(effectType) {
        return this.effectCache.getBonus(effectType);
    }

    getConditionalBonus(effectType, additionalContext = {}) {
        const context = { character: this, manager: this.manager, ...additionalContext };
        return this.effectCache.getConditionalBonus(effectType, context);
    }

    /**
     * Get stat bonuses from all effect sources.
     * Builds context for scalable effects (job level, equipment upgrade level, etc.)
     * @param {string} statId - The stat ID to get bonuses for
     * @returns {{ flat: number, percent: number }} Combined stat bonuses
     */
    getStatBonus(statId) {
        // Build context for scalable effects
        const context = {
            character: this,
            combatJob: this.combatJob,
            passiveJob: this.passiveJob,
            manager: this.manager
        };
        
        // Hero's effectCache already includes party effects via the 'party' source
        // so we don't need to query party.effectCache separately (that would double-count)
        const charBonus = this.effectCache.getStatBonus(statId, context);
        let flat = charBonus.flat || 0;
        let percent = charBonus.percent || 0;
        
        return { flat, percent };
    }

    invalidateEffects(sourceId) {
        this.effectCache.invalidate(sourceId);
        // Queue stats UI update since effect bonuses may have changed
        this.stats.renderQueue.stats = true;
        // Invalidate stat breakdown cache so tooltips show updated values
        if (this.statBreakdownCache) {
            this.statBreakdownCache.invalidate();
        }
    }

    getEffectiveStat(stat) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);

        // Hero's effectCache already includes party effects via the 'party' source
        // so we don't need to query party.effectCache separately (that would double-count)
        let allStatBonus = this.getPassiveBonus('all_stat_bonus');

        return StatCalculator.calculate(
            this.stats.get(stat),
            this.getStatBonus(stat.id),
            allStatBonus
        );
    }

    damage({ amount }, character) {
        if(this.dead)
            return 0;

        // Cap XP-eligible damage to actual HP remaining (no XP from overkill)
        const effectiveDamage = Math.min(amount, this.hitpoints);

        this.hitpoints -= amount;

        if(isNaN(this.hitpoints))
            this.hitpoints = 0;

        // Note: CombatTracker now listens to after_damage_delivered/received triggers
        // XP is now awarded in effect-processor.mjs at /250 rate for damage dealt and taken

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

                let preventCheck = this.trigger('before_death', { prevented: false, preventDeathHealAmount: 0 });
                if(preventCheck.prevented) {

                    const healPct = preventCheck.preventDeathHealAmount || 0;
                    if(healPct > 0) {
                        this.hitpoints = Math.max(1, Math.floor(this.maxHitpoints * (healPct / 100)));
                    } else {
                        this.hitpoints = 1;
                    }
                    this.manager.log.add(`${this.getDisplayName()} cheated death!`, {
                        category: 'combat_mechanics',
                        source: this
                    });
                    this.renderQueue.hitpoints = true;
                    return effectiveDamage;
                }

                this.dead = true;

                this.onDeath();

                this.trigger('death');

                if(this.manager && this.manager.party) {
                    let party;
                    if(this.isHero) {
                        party = this.manager.party.all;
                    } else if(this.manager.encounter && this.manager.encounter.party && this.manager.encounter.party.all) {
                        party = this.manager.encounter.party.all;
                    } else {
                        party = [];
                    }
                    party.forEach(member => {
                        if(member !== this && !member.dead) {
                            member.trigger('ally_death', { deadAlly: this });
                        }
                    });
                }
            }
        } else {

        }
        this.renderQueue.hitpoints = true;
        return effectiveDamage;
    }

    heal({ amount }, character) {
        if(this.dead || this.hitpoints === this.maxHitpoints)
            return 0;

        const actualHeal = Math.min(amount, this.maxHitpoints - this.hitpoints);
        this.hitpoints += actualHeal;

        if(isNaN(this.hitpoints))
            this.hitpoints = 0;

        // Note: CombatTracker now listens to after_heal_delivered trigger
        // XP is now awarded in effect-processor.mjs at /250 rate for healing done and received

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
        return actualHeal;
    }

    revive({ amount=100 }, character) {
        if(!this.dead)
            return;

        this.dead = false;

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
        this.manager.log.add(`${this.getDisplayName()} dies`, {
            category: 'combat_death',
            source: this
        });
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
        this.card.name = this.getDisplayName(true);
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

    // Required by base class contract - no additional registration needed
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