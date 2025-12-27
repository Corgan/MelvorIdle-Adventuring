const { loadModule } = mod.getContext(import.meta);

const { createEffect } = await loadModule('src/adventuring-utils.mjs');

/**
 * AdventuringModifiers - Centralized modifier system for the Adventuring skill
 * 
 * This system aggregates modifiers from multiple sources:
 * - Melvor's built-in modifier system (mastery bonuses)
 * - Equipment bonuses
 * - Consumable/Tavern drink effects
 * - Achievement rewards
 * - Aura effects (for combat modifiers)
 * 
 * Modifiers are separated into two categories:
 * 1. PASSIVE MODIFIERS - Always active stat changes, percentage bonuses
 * 2. TRIGGERED EFFECTS - Event-based effects handled by the aura/trigger system
 */

export class AdventuringModifiers {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        
        // Cache for computed modifiers (cleared when sources change)
        this.cache = new Map();
        this.cacheValid = false;
    }

    /**
     * Invalidate the modifier cache (call when equipment, consumables, etc. change)
     */
    invalidateCache() {
        this.cache.clear();
        this.cacheValid = false;
    }

    /**
     * Get all passive effects from Melvor modifiers as StandardEffect objects.
     * These are global modifiers that affect all heroes.
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        const effects = [];
        
        // Map Melvor modifiers to StandardEffect types
        const modifierEffectMap = {
            'masteryXP': 'increase_mastery_xp_percent',
            'dungeonXP': 'increase_dungeon_xp_percent',
            'exploreSpeed': 'increase_explore_speed_percent',
            'monsterDropRate': 'increase_drop_rate_percent',
            'monsterDropQty': 'increase_drop_qty_percent',
            'materialDropRate': 'increase_material_drop_percent',
            'abilityLearnChance': 'increase_ability_learn_percent',
            'consumablePreservation': 'consumable_preservation_percent',
            'bonusEnergy': 'increase_energy_flat',
            'upgradeCost': 'reduce_upgrade_cost_percent',
            'trapSpawnRate': 'increase_trap_rate_percent',
            'fountainSpawnRate': 'increase_fountain_rate_percent',
            'treasureSpawnRate': 'increase_treasure_rate_percent',
            'shrineSpawnRate': 'increase_shrine_rate_percent',
            'globalMasteryXP': 'increase_mastery_xp_percent'
        };
        
        // Get values from Melvor's modifier system
        for(const [modifierId, effectType] of Object.entries(modifierEffectMap)) {
            const value = this.getMelvorModifier(modifierId, {});
            if(value !== 0) {
                effects.push(createEffect(
                    {
                        trigger: 'passive',
                        type: effectType,
                        value: value
                    },
                    this,
                    'Melvor Modifiers'
                ));
            }
        }
        
        return effects;
    }

    /**
     * Get a modifier value, aggregating from all sources
     * @param {string} modifierId - The modifier type (e.g., 'masteryXP', 'jobStatBonus', 'damageBonus')
     * @param {Object} context - Context for scoped modifiers (action, monster type, etc.)
     * @returns {number} - The total modifier value
     */
    getValue(modifierId, context = {}) {
        const cacheKey = this.getCacheKey(modifierId, context);
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        let total = 0;
        
        // 1. Get from Melvor modifier system (mastery bonuses)
        total += this.getMelvorModifier(modifierId, context);
        
        // 2. Get from equipment (heroes only)
        total += this.getEquipmentModifier(modifierId, context);
        
        // 3. Get from active consumables
        total += this.getConsumableModifier(modifierId, context);
        
        // 4. Get from tavern drinks
        total += this.getTavernModifier(modifierId, context);
        
        // 5. Get from permanent achievement bonuses
        total += this.getAchievementModifier(modifierId, context);
        
        this.cache.set(cacheKey, total);
        return total;
    }

    /**
     * Generate a cache key for a modifier query
     */
    getCacheKey(modifierId, context) {
        const contextStr = context.action?.id || context.monster?.id || context.type || '';
        return `${modifierId}:${contextStr}`;
    }

    /**
     * Get modifier value from Melvor's built-in system
     */
    getMelvorModifier(modifierId, context) {
        // Map our modifier IDs to Melvor modifier IDs
        const melvorModifierMap = {
            'masteryXP': 'adventuring:adventuringMasteryXP',
            'dungeonXP': 'adventuring:adventuringDungeonXP',
            'exploreSpeed': 'adventuring:adventuringExploreSpeed',
            'trapSpawnRate': 'adventuring:adventuringTrapSpawnRate',
            'fountainSpawnRate': 'adventuring:adventuringFountainSpawnRate',
            'treasureSpawnRate': 'adventuring:adventuringTreasureSpawnRate',
            'shrineSpawnRate': 'adventuring:adventuringShrineSpawnRate',
            'monsterDropRate': 'adventuring:adventuringMonsterDropRate',
            'monsterDropQty': 'adventuring:adventuringMonsterDropQty',
            'abilityLearnChance': 'adventuring:adventuringAbilityLearnChance',
            'jobStatBonus': 'adventuring:adventuringJobStatBonus',
            'upgradeCost': 'adventuring:adventuringUpgradeCost',
            'consumablePreservation': 'adventuring:adventuringConsumablePreservation',
            'materialDropRate': 'adventuring:adventuringMaterialDropRate',
            'bonusEnergy': 'adventuring:adventuringBonusEnergy',
            'globalMasteryXP': 'masteryXP'
        };

        const melvorId = melvorModifierMap[modifierId];
        if (!melvorId) return 0;

        try {
            // Build query for scoped modifiers
            let query = this.manager.getModifierQuery();
            if (context.action) {
                query = this.manager.getActionModifierQuery(context.action);
            }
            
            return this.game.modifiers.getValue(melvorId, query);
        } catch (e) {
            console.warn(`[AdventuringModifiers] Failed to get Melvor modifier ${melvorId}:`, e);
            return 0;
        }
    }

    /**
     * Get modifier value from equipped items
     */
    getEquipmentModifier(modifierId, context) {
        let total = 0;
        
        // Check all heroes' equipment
        this.manager.party.all.forEach(hero => {
            if (!hero.equipment) return;
            
            hero.equipment.slots.forEach((slot) => {
                const item = slot.item;
                if (!item || !item.modifiers) return;
                
                item.modifiers.forEach(mod => {
                    if (mod.type === modifierId) {
                        // Check if modifier is scoped to a specific context
                        if (mod.targetType && context.type !== mod.targetType) return;
                        if (mod.action && context.action?.id !== mod.action) return;
                        
                        total += mod.value || 0;
                    }
                });
            });
        });
        
        return total;
    }

    /**
     * Get modifier value from active consumables
     */
    getConsumableModifier(modifierId, context) {
        let total = 0;
        
        if (!this.manager.consumables || !this.manager.consumables.slots) return total;
        
        // Check each consumable slot
        this.manager.consumables.slots.forEach(slot => {
            const consumable = slot.consumable;
            if (!consumable || slot.charges <= 0) return;
            if (consumable.triggerType !== 'passive') return;
            
            if (consumable.effects) {
                consumable.effects.forEach(effect => {
                    if (this.effectMatchesModifier(effect, modifierId, context)) {
                        total += effect.value || effect.amount || 0;
                    }
                });
            }
        });
        
        return total;
    }

    /**
     * Get modifier value from active tavern drinks
     */
    getTavernModifier(modifierId, context) {
        let total = 0;
        
        if (!this.manager.tavern) return total;
        
        const activeDrink = this.manager.tavern.activeDrink;
        if (!activeDrink || !activeDrink.effects) return total;
        
        activeDrink.effects.forEach(effect => {
            if (this.effectMatchesModifier(effect, modifierId, context)) {
                total += effect.value || effect.amount || 0;
            }
        });
        
        return total;
    }

    /**
     * Get modifier value from permanent achievement bonuses
     */
    getAchievementModifier(modifierId, context) {
        let total = 0;
        
        if (!this.manager.achievementManager) return total;
        
        const bonuses = this.manager.achievementBonuses || {};
        
        // Check for matching permanent stat bonuses
        if (bonuses[modifierId]) {
            total += bonuses[modifierId];
        }
        
        return total;
    }

    /**
     * Check if an effect matches a modifier query
     */
    effectMatchesModifier(effect, modifierId, context) {
        // Map effect types to modifier IDs
        const effectTypeMap = {
            'stat_bonus': 'statBonus',
            'increase_stat_flat': 'statBonus',
            'increase_stat_percent': 'statBonusPercent',
            'xp_bonus': 'masteryXP',
            'loot_bonus': 'materialDropRate',
            'damage_bonus': 'damageBonus',
            'damage_reduction': 'damageReduction',
            'crit_chance': 'critChance',
            'crit_damage': 'critDamage'
        };
        
        const mappedType = effectTypeMap[effect.type];
        if (mappedType !== modifierId) return false;
        
        // Check stat-specific modifiers
        if (effect.stat && context.stat && effect.stat !== context.stat) return false;
        
        return true;
    }

    /**
     * Convenience methods for common modifier queries
     */
    
    getMasteryXPBonus(action) {
        const base = this.getValue('masteryXP', { action }) / 100;
        const global = this.getValue('globalMasteryXP', { action }) / 100;
        return base + global;
    }
    
    getJobStatBonus(job) {
        return this.getValue('jobStatBonus', { action: job }) / 100;
    }
    
    getMonsterDropRateBonus(monster) {
        return this.getValue('monsterDropRate', { action: monster }) / 100;
    }
    
    getMonsterDropQtyBonus(monster) {
        return this.getValue('monsterDropQty', { action: monster }) / 100;
    }
    
    getMaterialDropRateBonus() {
        return this.getValue('materialDropRate') / 100;
    }
    
    getExploreSpeedBonus(area) {
        return this.getValue('exploreSpeed', { action: area }) / 100;
    }
    
    getUpgradeCostReduction(item) {
        return this.getValue('upgradeCost', { action: item }) / 100;
    }
    
    getConsumablePreservationChance() {
        return this.getValue('consumablePreservation') / 100;
    }
    
    getBonusEnergy() {
        return this.getValue('bonusEnergy');
    }
    
    getAbilityLearnChanceBonus() {
        return this.getValue('abilityLearnChance') / 100;
    }

    getDungeonXPBonus(area) {
        return this.getValue('dungeonXP', { action: area }) / 100;
    }

    getTrapSpawnRateMod() {
        return this.getValue('trapSpawnRate');
    }

    getFountainSpawnRateMod() {
        return this.getValue('fountainSpawnRate');
    }

    getTreasureSpawnRateMod() {
        return this.getValue('treasureSpawnRate');
    }

    getShrineSpawnRateMod() {
        return this.getValue('shrineSpawnRate');
    }

    /**
     * Combat-specific modifiers (checked per-character during combat)
     */
    
    getDamageBonusVsType(attacker, targetType) {
        let total = 0;
        
        // Equipment bonuses
        if (attacker.equipment) {
            attacker.equipment.slots.forEach((slot) => {
                const item = slot.item;
                if (!item || !item.modifiers) return;
                
                item.modifiers.forEach(mod => {
                    if (mod.type === 'damage_bonus_vs_type' && mod.targetType === targetType) {
                        total += mod.value || 0;
                    }
                });
            });
        }
        
        return total;
    }
    
    getDamageReductionVsType(defender, attackerType) {
        let total = 0;
        
        // Equipment bonuses
        if (defender.equipment) {
            defender.equipment.slots.forEach((slot) => {
                const item = slot.item;
                if (!item || !item.modifiers) return;
                
                item.modifiers.forEach(mod => {
                    if (mod.type === 'damage_reduction_vs_type' && mod.targetType === attackerType) {
                        total += mod.value || 0;
                    }
                });
            });
        }
        
        return total;
    }
    
    /**
     * Milestone-based combat bonuses (from monster kill milestones)
     */
    
    getMilestoneDamageBonusVsType(tags) {
        if(!this.manager.milestoneModifiers) return 0;
        let bonus = 0;
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if(modifiers && modifiers.damage_bonus_vs_type) {
                bonus += modifiers.damage_bonus_vs_type;
            }
        }
        return bonus / 100; // Convert to decimal
    }
    
    getMilestoneDamageReductionVsType(tags) {
        if(!this.manager.milestoneModifiers) return 0;
        let reduction = 0;
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if(modifiers && modifiers.damage_reduction_vs_type) {
                reduction += modifiers.damage_reduction_vs_type;
            }
        }
        return reduction / 100; // Convert to decimal
    }
    
    getMilestoneXPBonusVsType(tags) {
        if(!this.manager.milestoneModifiers) return 0;
        let bonus = 0;
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            const modifiers = this.manager.milestoneModifiers[cleanTag];
            if(modifiers && modifiers.exp_bonus_vs_type) {
                bonus += modifiers.exp_bonus_vs_type;
            }
        }
        return bonus / 100; // Convert to decimal
    }
    
    getMilestoneMaterialBonus(tags) {
        if(!this.manager.milestoneMaterialBonuses) return 0;
        let bonus = 0;
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            if(this.manager.milestoneMaterialBonuses[cleanTag]) {
                bonus += this.manager.milestoneMaterialBonuses[cleanTag];
            }
        }
        return bonus / 100; // Convert to decimal
    }
    
    /**
     * Combined vs_type bonuses (equipment + milestones)
     */
    
    getTotalDamageBonusVsType(attacker, tags) {
        let total = 0;
        
        // Add equipment bonuses for each tag
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            total += this.getDamageBonusVsType(attacker, cleanTag);
        }
        
        // Add milestone bonuses
        total += this.getMilestoneDamageBonusVsType(tags) * 100; // Convert back to percentage
        
        return total / 100; // Return as decimal
    }
    
    getTotalDamageReductionVsType(defender, tags) {
        let total = 0;
        
        // Add equipment bonuses for each tag
        for(const tag of tags) {
            const tagName = typeof tag === 'string' ? tag : tag.id;
            const cleanTag = tagName.replace('adventuring:', '');
            total += this.getDamageReductionVsType(defender, cleanTag);
        }
        
        // Add milestone bonuses
        total += this.getMilestoneDamageReductionVsType(tags) * 100; // Convert back to percentage
        
        return total / 100; // Return as decimal
    }
}
