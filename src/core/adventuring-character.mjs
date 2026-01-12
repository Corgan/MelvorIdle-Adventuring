const { loadModule } = mod.getContext(import.meta);

const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringAuras } = await loadModule('src/combat/adventuring-auras.mjs');
const { createEffect, EffectCache, defaultEffectProcessor, SimpleEffectInstance, evaluateCondition, buildEffectContext, StatCalculator, EffectLimitTracker } = await loadModule('src/core/adventuring-utils.mjs');

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

        this.initEffectCache();
    }

    initEffectCache() {

        this.effectCache.registerSource('auras', () => this.auras.getEffects());

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




    canEffectTrigger(effect, source) {
        return this.effectLimitTracker.canTrigger(effect, source);
    }

    recordEffectTrigger(effect, source) {
        this.effectLimitTracker.record(effect, source);
    }

    resetEffectLimits(limitType) {
        this.effectLimitTracker.reset(limitType);
    }




    getAllPendingEffectsForTrigger(type, context) {
        const pending = [];

        if (this.auras) {
            const auraEffects = this.auras.getEffectsForTrigger(type, context);
            pending.push(...auraEffects);
        }

        return pending;
    }

    processPendingEffect(pending, context) {
        const { effect, source, sourceName, sourceType } = pending;

        if (effect.condition) {
            if (!evaluateCondition(effect.condition, context)) {
                return false;
            }
        }

        if (!this.canEffectTrigger(effect, source)) {
            return false;
        }

        const chance = effect.chance || 100;
        if (Math.random() * 100 > chance) {
            return false;
        }

        let amount = effect.amount || 0;
        if (sourceType === 'equipment' && effect.scaling && source.level > 0) {
            amount += Math.floor(source.level * effect.scaling);
        }

        if (sourceType === 'aura') {
            this.processAuraEffect(effect, source, sourceName, context);
        } else {

            this.processTriggeredEffect(effect, amount, context, sourceName);
        }

        this.recordEffectTrigger(effect, source);

        return true;
    }

    processAuraEffect(effect, instance, sourceName, context) {

        const processorContext = {
            character: this,
            manager: this.manager,
            extra: context
        };

        defaultEffectProcessor.process({ effect, instance }, processorContext);
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

        const context = buildEffectContext(this, extra);

        const pending = this.getAllPendingEffectsForTrigger(type, context);

        for (const p of pending) {
            this.processPendingEffect(p, context);
        }

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

    processTriggeredEffect(effect, amount, extra, sourceName) {

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

        let immunityCheck = this.trigger('before_debuff_received', {});
        if(immunityCheck.prevented) {
            return; // Debuff blocked by immunity
        }

        this.auras.add(id, builtEffect, character);
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

    getStatBonus(statId) {
        return this.effectCache.getStatBonus(statId);
    }

    invalidateEffects(sourceId) {
        this.effectCache.invalidate(sourceId);
    }

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

        if(character && character.isHero && !this.isHero && this.manager.achievements) {
            const stats = this.manager.achievementManager.stats;
            if(stats) {
                stats.totalDamage = (stats.totalDamage || 0) + amount;
            }
        }

        if(character && character.isHero && !this.isHero && amount > 0) {

            const baseXP = Math.max(1, Math.floor(amount / 2));
            const difficultyXPBonus = this.manager.dungeon?.getBonus('xp_percent') / 100 || 0;
            const equipmentXP = Math.floor(baseXP * (1 + difficultyXPBonus));

            if (character.equipment && character.equipment.slots) {
                character.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                        equipmentSlot.item.addXP(equipmentXP);
                    }
                });
            }

            if(character.combatJob && character.combatJob.isMilestoneReward) {
                character.combatJob.addXP(Math.floor(equipmentXP / 2));
            }
        }


        const isCharacterEnemy = character && !character.isHero;
        if(this.isHero && isCharacterEnemy && amount > 0 && !this.dead) {

            const baseXP = Math.max(1, Math.floor(amount / 2));
            const difficultyXPBonus = this.manager.dungeon?.getBonus('xp_percent') / 100 || 0;
            const equipmentXP = Math.floor(baseXP * (1 + difficultyXPBonus));

            if (this.equipment && this.equipment.slots) {
                this.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                        equipmentSlot.item.addXP(equipmentXP);
                    }
                });
            }

            if(this.combatJob && this.combatJob.isMilestoneReward) {
                this.combatJob.addXP(Math.floor(equipmentXP / 2));
            }
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

                let preventCheck = this.trigger('before_death', { prevented: false, preventDeathHealAmount: 0 });
                if(preventCheck.prevented) {

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
    }

    heal({ amount }, character) {
        if(this.dead || this.hitpoints === this.maxHitpoints)
            return;

        const actualHeal = Math.min(amount, this.maxHitpoints - this.hitpoints);
        this.hitpoints += amount;

        if(isNaN(this.hitpoints))
            this.hitpoints = 0;

        if(this.isHero && this.manager.achievements && actualHeal > 0) {
            const stats = this.manager.achievementManager.stats;
            if(stats) {
                stats.totalHealing = (stats.totalHealing || 0) + actualHeal;
            }
        }


        if(character && character.isHero && actualHeal > 0) {

            const equipmentXP = Math.max(1, Math.floor(actualHeal / 2));

            if (character.equipment && character.equipment.slots) {
                character.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                        equipmentSlot.item.addXP(equipmentXP);
                    }
                });
            }

            if(character.combatJob && character.combatJob.isMilestoneReward) {
                character.combatJob.addXP(Math.floor(equipmentXP / 2));
            }
        }


        if(this.isHero && character && character.isHero && actualHeal > 0) {

            const equipmentXP = Math.max(1, Math.floor(actualHeal / 2));

            if (this.equipment && this.equipment.slots) {
                this.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied && equipmentSlot.item) {
                        equipmentSlot.item.addXP(equipmentXP);
                    }
                });
            }

            if(this.combatJob && this.combatJob.isMilestoneReward) {
                this.combatJob.addXP(Math.floor(equipmentXP / 2));
            }
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