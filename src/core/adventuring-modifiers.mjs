const { loadModule } = mod.getContext(import.meta);

const { createEffect, EffectCache } = await loadModule('src/core/adventuring-utils.mjs');

/**
 * AdventuringModifiers - Centralized modifier system for the Adventuring skill
 * 
 * This system aggregates modifiers from multiple sources using the standard effect system:
 * - Consumable effects
 * - Tavern drink effects
 * - Achievement rewards
 * - Mastery effects (monster/area/job/equipment)
 * 
 * All bonuses use the standard effect format: { trigger: 'passive', type, value }
 * Effect types use simple names with positive/negative values:
 *   - drop_rate_percent: +10 = 10% more drops
 *   - upgrade_cost_percent: -25 = 25% cheaper upgrades
 */

export class AdventuringModifiers {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        
        // Use EffectCache for aggregating effects from global sources
        this.effectCache = new EffectCache();
        
        // Register global effect sources
        this.effectCache.registerSource('consumables', () => this.getConsumableEffects());
        this.effectCache.registerSource('tavern', () => this.getTavernEffects());
        this.effectCache.registerSource('achievements', () => this.getAchievementEffects());
    }

    /**
     * Invalidate the modifier cache (call when consumables, tavern, etc. change)
     */
    invalidateCache() {
        this.effectCache.invalidateAll();
    }

    /**
     * Get all passive effects from global sources.
     * Used by heroes to include global modifiers in their effect cache.
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        return this.effectCache.getEffects('passive');
    }

    /**
     * Get a passive bonus by effect type.
     * Sums all passive effects of the given type from global sources.
     * @param {string} effectType - Effect type (e.g., 'drop_rate_percent')
     * @param {object} [context] - Optional context with action for mastery effects
     * @returns {number} - The total bonus value (positive = increase, negative = decrease)
     */
    getBonus(effectType, context = {}) {
        let total = this.effectCache.getBonus(effectType);
        
        // Add mastery effects if an action is provided
        if (context.action && typeof context.action.getMasteryEffectValue === 'function') {
            total += context.action.getMasteryEffectValue(effectType);
        }
        
        return total;
    }

    // ========================================================================
    // Effect Source Getters
    // ========================================================================

    /**
     * Get effects from active consumables
     */
    getConsumableEffects() {
        const effects = [];
        
        if (!this.manager.consumables || !this.manager.consumables.slots) return effects;
        
        this.manager.consumables.slots.forEach(slot => {
            const consumable = slot.consumable;
            if (!consumable || slot.charges <= 0) return;
            if (consumable.triggerType !== 'passive') return;
            
            if (consumable.effects) {
                consumable.effects.forEach(effectData => {
                    effects.push(createEffect(effectData, consumable, consumable.name));
                });
            }
        });
        
        return effects;
    }

    /**
     * Get effects from active tavern drink
     */
    getTavernEffects() {
        const effects = [];
        
        if (!this.manager.tavern) return effects;
        
        const activeDrink = this.manager.tavern.activeDrink;
        if (!activeDrink || !activeDrink.effects) return effects;
        
        activeDrink.effects.forEach(effectData => {
            effects.push(createEffect(effectData, activeDrink, activeDrink.name));
        });
        
        return effects;
    }

    /**
     * Get effects from permanent achievement bonuses
     */
    getAchievementEffects() {
        const effects = [];
        
        if (!this.manager.achievementManager) return effects;
        
        const bonuses = this.manager.achievementBonuses || {};
        
        // Convert achievement bonuses to standard effects
        for (const [type, value] of Object.entries(bonuses)) {
            if (value !== 0) {
                effects.push(createEffect(
                    { trigger: 'passive', type, value },
                    this.manager.achievementManager,
                    'Achievement Bonus'
                ));
            }
        }
        
        return effects;
    }

    // ========================================================================
    // Convenience Methods - Use effect types directly
    // ========================================================================
    
    /**
     * Get mastery XP bonus (as decimal multiplier, e.g., 0.1 for 10%)
     */
    getMasteryXPBonus(action) {
        return this.getBonus('mastery_xp_percent', { action }) / 100;
    }
    
    /**
     * Get job stat bonus (as decimal multiplier)
     */
    getJobStatBonus(job) {
        return this.getBonus('job_stats_percent', { action: job }) / 100;
    }
    
    /**
     * Get monster drop rate bonus (as decimal multiplier)
     */
    getMonsterDropRateBonus(monster) {
        return this.getBonus('drop_rate_percent', { action: monster }) / 100;
    }
    
    /**
     * Get monster drop quantity bonus (as decimal multiplier)
     */
    getMonsterDropQtyBonus(monster) {
        return this.getBonus('drop_quantity_percent', { action: monster }) / 100;
    }
    
    /**
     * Get material drop rate bonus (as decimal multiplier)
     */
    getMaterialDropRateBonus() {
        return this.getBonus('material_drop_percent') / 100;
    }
    
    /**
     * Get explore speed bonus (as decimal multiplier)
     */
    getExploreSpeedBonus(area) {
        return this.getBonus('explore_speed_percent', { action: area }) / 100;
    }
    
    /**
     * Get upgrade cost modifier (as decimal multiplier)
     * Negative value = cost reduction (e.g., -0.25 = 25% cheaper)
     */
    getUpgradeCostReduction(item) {
        return this.getBonus('upgrade_cost_percent', { action: item }) / 100;
    }
    
    /**
     * Get consumable preservation chance (as decimal)
     */
    getConsumablePreservationChance() {
        return this.getBonus('consumable_preservation_percent') / 100;
    }
    
    /**
     * Get bonus energy (flat value)
     */
    getBonusEnergy() {
        return this.getBonus('energy_flat');
    }
    
    /**
     * Get ability learn chance bonus (as decimal multiplier)
     */
    getAbilityLearnChanceBonus() {
        return this.getBonus('ability_learn_chance_percent') / 100;
    }

    /**
     * Get dungeon XP bonus (as decimal multiplier)
     */
    getDungeonXPBonus(area) {
        return this.getBonus('dungeon_xp_percent', { action: area }) / 100;
    }

    /**
     * Get trap spawn rate modifier (percentage points, negative = fewer traps)
     */
    getTrapSpawnRateMod() {
        return this.getBonus('trap_spawn_rate_percent');
    }

    /**
     * Get fountain spawn rate modifier (percentage points)
     */
    getFountainSpawnRateMod() {
        return this.getBonus('fountain_spawn_rate_percent');
    }

    /**
     * Get treasure spawn rate modifier (percentage points)
     */
    getTreasureSpawnRateMod() {
        return this.getBonus('treasure_spawn_rate_percent');
    }

    /**
     * Get shrine spawn rate modifier (percentage points)
     */
    getShrineSpawnRateMod() {
        return this.getBonus('shrine_spawn_rate_percent');
    }

    // ========================================================================
    // Combat-specific modifiers (milestone-based vs_type bonuses)
    // ========================================================================
    
    /**
     * Get milestone damage bonus vs monster types (as decimal multiplier)
     */
    getMilestoneDamageBonusVsType(tags) {
        if (!this.manager.milestoneModifiers) return 0;
        let bonus = 0;
        for (const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if (modifiers && modifiers.damage_bonus_vs_type) {
                bonus += modifiers.damage_bonus_vs_type;
            }
        }
        return bonus / 100;
    }
    
    /**
     * Get milestone damage reduction vs monster types (as decimal multiplier)
     */
    getMilestoneDamageReductionVsType(tags) {
        if (!this.manager.milestoneModifiers) return 0;
        let reduction = 0;
        for (const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if (modifiers && modifiers.damage_reduction_vs_type) {
                reduction += modifiers.damage_reduction_vs_type;
            }
        }
        return reduction / 100;
    }
    
    /**
     * Get milestone XP bonus vs monster types (as decimal multiplier)
     */
    getMilestoneXPBonusVsType(tags) {
        if (!this.manager.milestoneModifiers) return 0;
        let bonus = 0;
        for (const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if (modifiers && modifiers.exp_bonus_vs_type) {
                bonus += modifiers.exp_bonus_vs_type;
            }
        }
        return bonus / 100;
    }
    
    /**
     * Get milestone material bonus for monster types (as decimal multiplier)
     */
    getMilestoneMaterialBonus(tags) {
        if (!this.manager.milestoneMaterialBonuses) return 0;
        let bonus = 0;
        for (const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            if (this.manager.milestoneMaterialBonuses[cleanTag]) {
                bonus += this.manager.milestoneMaterialBonuses[cleanTag];
            }
        }
        return bonus / 100;
    }
    
    /**
     * Get total damage bonus vs types (milestones only now, equipment uses aura system)
     */
    getTotalDamageBonusVsType(attacker, tags) {
        return this.getMilestoneDamageBonusVsType(tags);
    }
    
    /**
     * Get total damage reduction vs types (milestones only now, equipment uses aura system)
     */
    getTotalDamageReductionVsType(defender, tags) {
        return this.getMilestoneDamageReductionVsType(tags);
    }
}
