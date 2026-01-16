const { loadModule } = mod.getContext(import.meta);

const { AdventuringHero } = await loadModule('src/entities/adventuring-hero.mjs');
const { AdventuringEnemy } = await loadModule('src/entities/adventuring-enemy.mjs');
const { AdventuringPartyElement } = await loadModule('src/entities/components/adventuring-party.mjs');
const { evaluateCondition, buildEffectContext, createEffect, EffectLimitTracker, EffectCache, defaultEffectProcessor } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringParty {
    constructor(manager, game) {
        this.game = game;
        this.manager = manager;

        this.component = createElement('adventuring-party');

        this.effectLimitTracker = new EffectLimitTracker();
        this.effectCache = new EffectCache();

        // Cache for mastery completion effects (rarely changes)
        this._masteryCompletionCache = null;
        this._masteryCompletionDirty = true;
    }

    initEffectCache() {
        // Party-wide effect sources filtered for party scope
        this.effectCache.registerSource('consumables', {
            getEffects: (f) => this.manager.consumables?.getEffects(f) || [],
            filters: { scope: 'party' },
            onTrigger: (effect, context, host) => {
                const { source, sourceName, sourceTier } = effect;
                this.manager.consumables.removeCharges(source, sourceTier, 1);
                this.manager.log.add(`${sourceName} consumed a charge.`, {
                    category: 'system'
                });
            }
        });

        this.effectCache.registerSource('tavern', {
            getEffects: (f) => this.manager.tavern?.getEffects(f) || [],
            filters: { scope: 'party' }
        });

        // Dungeon/difficulty effects that target the party
        this.effectCache.registerSource('dungeon', () => 
            this.manager.dungeon?.getEffects({ party: 'ally' }) || []
        );

        // Party-scoped equipment effects from all heroes
        this.effectCache.registerSource('heroEquipment', () => {
            const effects = [];
            for (const hero of this.all) {
                if (!hero.equipment) continue;
                const equipmentEffects = hero.equipment.getEffects({ scope: 'party' });
                for (const effect of equipmentEffects) {
                    effects.push({
                        ...effect,
                        sourceName: `${hero.name}'s ${effect.sourceName}`
                    });
                }
            }
            return effects;
        });

        // Achievement effects (for passive bonuses - no scope filtering)
        this.effectCache.registerSource('achievements', () =>
            this.manager.achievementManager ? this.manager.achievementManager.getEffects() : []
        );

        // Mastery completion effects (for passive bonuses)
        this.effectCache.registerSource('mastery', () => this.getMasteryCompletionEffects());
    }

    // ========== Mastery Completion Effects ==========

    onMasteryMaxed() {
        this._masteryCompletionDirty = true;
        this.effectCache.invalidate('mastery');
    }

    getMasteryCompletionEffects() {
        if (!this._masteryCompletionDirty && this._masteryCompletionCache !== null) {
            return this._masteryCompletionCache;
        }

        const effects = [];
        const registries = [
            this.manager.areas,
            this.manager.monsters,
            this.manager.jobs,
            this.manager.baseItems
        ];

        for (const registry of registries) {
            if (!registry) continue;

            registry.forEach(action => {
                if (this.manager.getMasteryLevel(action) >= 99) {
                    const masteryCategory = action.masteryCategory;
                    if (!masteryCategory) return;

                    const categoryId = masteryCategory.id || `adventuring:${masteryCategory.localID}`;
                    const milestoneEffects = masteryCategory.getEffectsAtLevel(99) || [];

                    for (const effectData of milestoneEffects) {
                        if (effectData.type === 'category_xp_percent') {
                            effects.push(createEffect(
                                { ...effectData, category: categoryId },
                                action,
                                `${action.name} Mastery`,
                                'mastery'
                            ));
                        }
                    }
                }
            });
        }

        this._masteryCompletionCache = effects;
        this._masteryCompletionDirty = false;
        return effects;
    }

    // ========== Bonus Query Methods ==========

    /**
     * Get a passive bonus by effect type from party-wide effects.
     */
    getBonus(effectType, context = {}) {
        let total = this.getPassiveBonus(effectType);

        // Add action-specific mastery effects
        if (context.action && typeof context.action.getMasteryEffectValue === 'function') {
            total += context.action.getMasteryEffectValue(effectType);
        }

        return total;
    }

    /**
     * Get bonus filtered by category (for category-specific XP bonuses).
     */
    getCategoryBonus(effectType, categoryId) {
        let total = 0;
        const effects = this.getEffects({ trigger: 'passive' });

        for (const effect of effects) {
            if (effect.type === effectType && effect.category === categoryId) {
                total += effect.value ?? effect.amount ?? 0;
            }
        }

        return total;
    }

    /**
     * Get spawn rate modifier for a specific spawn type.
     */
    getSpawnRateMod(spawnType, context = {}) {
        let total = 0;
        const effects = this.getEffects({ trigger: 'passive' });

        for (const effect of effects) {
            if (effect.type === 'spawn_rate_percent' && effect.spawnType === spawnType) {
                total += effect.value ?? effect.amount ?? 0;
            }
        }

        if (context.action && typeof context.action.getMasteryEffectValue === 'function') {
            total += context.action.getMasteryEffectValue('spawn_rate_percent', { spawnType });
        }

        return total;
    }

    // ========== Convenience Bonus Methods ==========

    getMasteryXPBonus(action) {
        let bonus = this.getBonus('xp_percent', { action });

        if (action && action.masteryCategory) {
            const categoryId = action.masteryCategory.id || `adventuring:${action.masteryCategory.localID}`;
            bonus += this.getCategoryBonus('category_xp_percent', categoryId);
        }

        return bonus / 100;
    }

    getJobStatBonus(job) {
        return this.getBonus('job_stats_percent', { action: job }) / 100;
    }

    getMonsterDropRateBonus(monster) {
        return this.getBonus('drop_rate_percent', { action: monster }) / 100;
    }

    getMonsterDropQtyBonus(monster) {
        return this.getBonus('drop_quantity_percent', { action: monster }) / 100;
    }

    getCurrencyDropBonus() {
        return this.getBonus('currency_drop_percent') / 100;
    }

    getMaterialDropRateBonus() {
        return this.getBonus('material_drop_percent') / 100;
    }

    getExploreSpeedBonus(area) {
        return this.getBonus('explore_speed_percent', { action: area }) / 100;
    }

    getUpgradeCostReduction(item) {
        return this.getBonus('upgrade_cost_percent', { action: item }) / 100;
    }

    getConsumablePreservationChance() {
        return this.getBonus('consumable_preservation_percent') / 100;
    }

    getBonusEnergy() {
        return this.getPassiveBonus('energy_flat');
    }

    getAbilityLearnChanceBonus() {
        return this.getBonus('ability_learn_chance_percent') / 100;
    }

    getDungeonXPBonus(area) {
        return this.getBonus('dungeon_xp_percent', { action: area }) / 100;
    }

    getTrapSpawnRateMod(context = {}) {
        return this.getSpawnRateMod('trap', context);
    }

    getFountainSpawnRateMod(context = {}) {
        return this.getSpawnRateMod('fountain', context);
    }

    getTreasureSpawnRateMod(context = {}) {
        return this.getSpawnRateMod('treasure', context);
    }

    getShrineSpawnRateMod(context = {}) {
        return this.getSpawnRateMod('shrine', context);
    }

    invalidateEffects(sourceId) {
        this.effectCache.invalidate(sourceId);
        // Also invalidate hero stats UI since party effects affect them
        this.forEach(hero => {
            if (hero.stats) {
                hero.stats.renderQueue.stats = true;
            }
        });
    }

    invalidateAllEffects(source) {
        // Invalidate party cache
        if (source) {
            this.effectCache.invalidate(source);
        }
        // Also invalidate hero caches
        this.forEach(hero => {
            if (hero.effectCache) {
                hero.invalidateEffects(source);
            }
        });
        // Invalidate dungeon's party_enemy_effects since it depends on consumables/tavern/equipment
        if (this.manager.dungeon?.effectCache) {
            this.manager.dungeon.effectCache.invalidate('party_enemy_effects');
        }
    }

    getEffects(filters = null) {
        return this.effectCache.getEffects(filters);
    }

    getPassiveBonus(effectType) {
        return this.effectCache.getBonus(effectType);
    }

    getStatBonus(statId) {
        return this.effectCache.getStatBonus(statId);
    }

    get all() {
        return [this.front, this.center, this.back];
    }

    get alive() {
        return this.all.filter(member => !member.dead);
    }

    get dead() {
        return this.all.filter(member => member.dead);
    }




    forEach(callback) {
        this.all.forEach(callback);
    }

    forEachLiving(callback) {
        this.alive.forEach(callback);
    }

    find(predicate) {
        return this.all.find(predicate);
    }

    some(predicate) {
        return this.all.some(predicate);
    }

    every(predicate) {
        return this.all.every(predicate);
    }

    get lowestHp() {
        const living = this.alive;
        if (living.length === 0) return undefined;
        return living.reduce((low, m) => m.hitpoints < low.hitpoints ? m : low);
    }

    get randomLiving() {
        const living = this.alive;
        if (living.length === 0) return undefined;
        return living[Math.floor(Math.random() * living.length)];
    }

    setAllLocked(locked) {
        this.all.forEach(member => member.setLocked(locked));
    }

    trigger(type, context = {}) {
        const partyContext = buildEffectContext(null, {
            ...context,
            party: this.all,
            manager: this.manager
        });

        this.effectCache.processTrigger(type, partyContext, {
            host: this,
            limitTracker: this.effectLimitTracker,
            effectModifier: (effect) => ({ ...effect, party: 'ally' })
        });

        // Trigger achievements with combat context
        if (this.manager.achievementManager && this.manager.combatTracker) {
            const achievementContext = {
                ...partyContext,
                source: this,
                triggerType: type,
                ...this.manager.combatTracker.getContext()
            };
            this.manager.achievementManager.trigger(type, achievementContext);
        }
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

    onLoad() {
        this.initEffectCache();
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

    /** Heroes that participate in combat (combatJob is not "none") */
    get combatParty() {
        return this.all.filter(member => 
            member.combatJob && member.combatJob.id !== 'adventuring:none'
        );
    }

    /** Heroes staying in town (combatJob is "none") */
    get townParty() {
        return this.all.filter(member => 
            !member.combatJob || member.combatJob.id === 'adventuring:none'
        );
    }

    /** Living members of the combat party */
    get combatAlive() {
        return this.combatParty.filter(member => !member.dead);
    }

    postDataRegistration() {
        super.postDataRegistration();
        this.all.forEach(member => member.postDataRegistration());
    }

    /**
     * Award XP to all party members' combat jobs (milestone rewards only)
     * @param {number} xp - Amount to award
     * @param {Object} options - { aliveOnly: false }
     */
    awardJobXP(xp, { aliveOnly = false } = {}) {
        const members = aliveOnly ? this.combatAlive : this.all;
        members.forEach(member => {
            if (member.combatJob?.isMilestoneReward) {
                member.combatJob.addXP(xp);
            }
        });
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