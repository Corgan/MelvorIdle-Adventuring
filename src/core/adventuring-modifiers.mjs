const { loadModule } = mod.getContext(import.meta);

const { createEffect, EffectCache } = await loadModule('src/core/adventuring-utils.mjs');

export class AdventuringModifiers {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.effectCache = new EffectCache();

        this.effectCache.registerSource('consumables', () => this.getConsumableEffects());
        this.effectCache.registerSource('tavern', () => this.getTavernEffects());
        this.effectCache.registerSource('achievements', () => this.getAchievementEffects());
        this.effectCache.registerSource('mastery_completion', () => this.getMasteryCompletionEffects());
    }

    invalidateCache() {
        this.effectCache.invalidateAll();
    }

    onMasteryMaxed() {
        this.effectCache.invalidate('mastery_completion');
    }

    getEffects() {
        return this.effectCache.getEffects('passive');
    }

    getBonus(effectType, context = {}) {
        let total = this.effectCache.getBonus(effectType);

        if (context.action && typeof context.action.getMasteryEffectValue === 'function') {
            total += context.action.getMasteryEffectValue(effectType);
        }

        return total;
    }

    getCategoryBonus(effectType, categoryId) {
        let total = 0;

        const passiveEffects = this.effectCache.getEffects('passive');
        for (const effect of passiveEffects) {
            if (effect.type === effectType && effect.category === categoryId) {
                total += effect.value ?? effect.amount ?? 0;
            }
        }

        return total;
    }




    getConsumableEffects() {
        const effects = [];

        if (!this.manager.consumables || !this.manager.consumables.equipped) return effects;

        this.manager.consumables.equipped.forEach(({ consumable, tier }) => {
            if (!consumable) return;
            const charges = this.manager.consumables.getCharges(consumable, tier);
            if (charges <= 0) return;

            const tierEffects = consumable.getTierEffects(tier);
            tierEffects.forEach(effectData => {

                if (effectData.trigger === 'passive') {
                    effects.push(createEffect(effectData, consumable, consumable.getTierName(tier)));
                }
            });
        });

        return effects;
    }

    getTavernEffects() {
        if (!this.manager.tavern) return [];

        return this.manager.tavern.getEffects();
    }

    getAchievementEffects() {
        const effects = [];

        if (!this.manager.achievementManager) return effects;


        for (const stat of this.manager.stats.allObjects) {
            const value = this.manager.achievementManager.getStatBonus(stat.id);
            if (value !== 0) {
                effects.push(createEffect(
                    { trigger: 'passive', type: stat.id, value },
                    this.manager.achievementManager,
                    'Achievement Bonus'
                ));
            }
        }

        return effects;
    }

    getMasteryCompletionEffects() {
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
                                `${action.name} Mastery`
                            ));
                        }
                    }
                }
            });
        }

        return effects;
    }




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
        return this.getBonus('energy_flat');
    }

    getAbilityLearnChanceBonus() {
        return this.getBonus('ability_learn_chance_percent') / 100;
    }

    getDungeonXPBonus(area) {
        return this.getBonus('dungeon_xp_percent', { action: area }) / 100;
    }

    getSpawnRateMod(spawnType, context = {}) {
        let total = 0;

        const passiveEffects = this.effectCache.getEffects('passive');
        for (const effect of passiveEffects) {
            if (effect.type === 'spawn_rate_percent' && effect.spawnType === spawnType) {
                const val = (effect.value !== undefined) ? effect.value : ((effect.amount !== undefined) ? effect.amount : 0);
                total += val;
            }
        }

        if (context.action && typeof context.action.getMasteryEffectValue === 'function') {
            total += context.action.getMasteryEffectValue('spawn_rate_percent', { spawnType });
        }

        return total;
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




    getMilestoneDamageBonusVsType(tags) {

        return 0;
    }

    getMilestoneDamageReductionVsType(tags) {

        return 0;
    }

    getMilestoneXPBonusVsType(tags) {

        return 0;
    }

    getMilestoneMaterialBonus(tags) {

        return 0;
    }

    getTotalDamageBonusVsType(attacker, tags) {
        return this.getMilestoneDamageBonusVsType(tags);
    }

    getTotalDamageReductionVsType(defender, tags) {
        return this.getMilestoneDamageReductionVsType(tags);
    }
}
