const { loadModule } = mod.getContext(import.meta);

const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { getAuraName, UNKNOWN_MEDIA, describeEffectsInline } = await loadModule('src/core/adventuring-utils.mjs');

/**
 * Effect types for difficulties:
 * - all_stat_percent: +X% to stats (with target/party: e.g., party: 'enemy' for enemy stats)
 * - xp_percent: +X% to XP gained (additive)
 * - loot_percent: +X% to loot quantity (additive)
 * - heal_percent: Heal for X% (with target/party: e.g., target: 'all', party: 'hero')
 * - buff: Apply a buff aura (with target/party for targeting)
 * - debuff: Apply a debuff (with target/party for targeting)
 */
class DifficultyEffect extends AdventuringScalableEffect {
    constructor(manager, game, difficulty, data) {
        super(manager, game, data);
        this.difficulty = difficulty;
        this.trigger = data.trigger || 'passive'; // 'passive', 'dungeon_start', 'enemy_spawn'
    }
}

/**
 * AdventuringDifficulty - Represents a difficulty mode for dungeons
 * 
 * Difficulties are NamespacedObjects with effects that modify dungeon runs.
 * All modifiers (stat/xp/loot multipliers) are defined as effects for consistency.
 */
export class AdventuringDifficulty extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        
        this._name = data.name;
        this._description = data.description || '';
        this._media = data.media;
        this.color = data.color || 'text-white';
        
        // Unlock requirements
        this.unlockLevel = data.unlockLevel || 0;
        
        // Wave-based mode flag (infinite floors, wave counter)
        this.isEndless = data.isEndless === true;
        
        // Wave scaling configuration (for endless-style modes)
        // Defines how stats/rewards scale per wave
        this.waveScaling = data.waveScaling || null;
        
        // Wave generation configuration (for infinite modes)
        // type: 'infinite' = waves repeat forever
        // floorsPerWave: number of floors per wave (default 1)
        // floorSelection: 'cycle' = rotate through area floors, 'random' = pick random floor, 'first' = always use first floor
        this.waveGeneration = data.waveGeneration || null;
        
        // All modifiers and effects are stored as effects
        this.effects = (data.effects || []).map(effect => 
            new DifficultyEffect(this.manager, this.game, this, effect)
        );
    }

    /**
     * Check if this difficulty uses infinite wave generation
     */
    get isInfinite() {
        return this.waveGeneration && this.waveGeneration.type === 'infinite';
    }

    /**
     * Get floors per wave (default 1 for infinite modes)
     */
    get floorsPerWave() {
        return this.waveGeneration && this.waveGeneration.floorsPerWave !== undefined ? this.waveGeneration.floorsPerWave : 1;
    }

    /**
     * Get floor selection strategy
     */
    get floorSelection() {
        return this.waveGeneration && this.waveGeneration.floorSelection !== undefined ? this.waveGeneration.floorSelection : 'first';
    }

    get name() {
        return this._name;
    }

    get description() {
        // Custom description takes priority
        if (this._description) return this._description;
        // Build from effects
        return describeEffectsInline(this.effects, this.manager) || 'No modifiers';
    }

    get media() {
        return this.manager.getMediaURL(this._media || UNKNOWN_MEDIA);
    }

    /**
     * Get all effects as StandardEffect objects for caching
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        return this.effects.map(effect => {
            let value = 1;
            if (effect.amount !== undefined && effect.amount.base !== undefined) {
                value = effect.amount.base;
            } else if (effect.getAmount !== undefined) {
                value = effect.getAmount();
            }
            let stacks = 1;
            if (effect.stacks !== undefined && effect.stacks.base !== undefined) {
                stacks = effect.stacks.base;
            } else if (effect.getStacks !== undefined) {
                stacks = effect.getStacks();
            }
            return {
                trigger: effect.trigger,
                type: effect.type,
                value: value,
                stacks: stacks,
                aura: effect.id,  // For buff/debuff effects, this is the aura ID
                source: this,
                sourceName: this.name
            };
        });
    }

    /**
     * Get the enemy stat bonus percent from effects (default 0)
     * Returns whole percent value (50 = +50%)
     */
    get enemyStatsPercent() {
        const effect = this.effects.find(e => 
            e.type === 'all_stat_percent' && e.party === 'enemy'
        );
        return effect && effect.amount ? effect.amount.base : 0;
    }

    /**
     * Get the stat multiplier (for game calculations)
     * Derived from enemyStatsPercent: 50% -> 1.5x multiplier
     */
    get statMultiplier() {
        return 1 + (this.enemyStatsPercent / 100);
    }

    /**
     * Get the XP bonus percent from effects (default 0)
     * Returns whole percent value (50 = +50%)
     */
    get xpPercent() {
        const effect = this.effects.find(e => e.type === 'xp_percent');
        return effect && effect.amount ? effect.amount.base : 0;
    }

    /**
     * Get the XP multiplier (for game calculations)
     * Derived from xpPercent: 50% -> 1.5x multiplier
     */
    get xpMultiplier() {
        return 1 + (this.xpPercent / 100);
    }

    /**
     * Get the loot bonus percent from effects (default 0)
     * Returns whole percent value (50 = +50%)
     */
    get lootPercent() {
        const effect = this.effects.find(e => e.type === 'loot_percent');
        return effect && effect.amount ? effect.amount.base : 0;
    }

    /**
     * Get the loot multiplier (for game calculations)
     * Derived from lootPercent: 50% -> 1.5x multiplier
     */
    get lootMultiplier() {
        return 1 + (this.lootPercent / 100);
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }

    /**
     * Check if this difficulty is unlocked for a given area
     * Normal difficulty is always unlocked, others require unlock mastery effect with unlockType: 'difficulty'
     * @param {AdventuringArea} area - The area to check unlock status for
     */
    isUnlocked(area) {
        // Normal difficulty (unlockLevel 0) is always available
        if (this.unlockLevel === 0) return true;
        
        // Check if area has the unlock effect for this difficulty
        return area.masteryEffects.some(e => 
            e.type === 'unlock' && e.unlockType === 'difficulty' && e.difficultyID === this.id
        );
    }

    /**
     * Apply difficulty effects at dungeon start
     */
    onDungeonStart(dungeon) {
        this.effects.forEach(effect => {
            if(effect.trigger !== 'dungeon_start') return;
            
            if(effect.type === 'buff') {
                // Apply buff to all party members
                dungeon.manager.party.all.forEach(member => {
                    if(!member.dead) {
                        member.buff(effect.id, { 
                            stacks: effect.getStacks(), 
                            amount: effect.getAmount() 
                        }, member);
                    }
                });
            }
        });
    }

    /**
     * Apply difficulty effects when an enemy spawns
     */
    onEnemySpawn(enemy, dungeon) {
        this.effects.forEach(effect => {
            if(effect.trigger !== 'enemy_spawn') return;
            
            if(effect.type === 'debuff') {
                enemy.debuff(effect.id, { 
                    stacks: effect.getStacks(), 
                    amount: effect.getAmount() 
                }, null);
            } else if(effect.type === 'buff' && effect.party === 'enemy') {
                // buff with party: 'enemy' applies to enemies
                enemy.buff(effect.id, { 
                    stacks: effect.getStacks(), 
                    amount: effect.getAmount() 
                }, null);
            }
        });
    }

    /**
     * Get all effects of a certain type
     */
    getEffectsOfType(type) {
        return this.effects.filter(e => e.type === type);
    }

    /**
     * Get tooltip content for this difficulty
     */
    get tooltip() {
        const lines = [];
        lines.push(`<div class="font-w700 ${this.color}">${this.name}</div>`);
        
        if(this.description) {
            lines.push(`<div class="text-muted">${this.description}</div>`);
        }
        
        lines.push('<hr class="my-1">');
        
        // Show multiplier effects
        const statMult = this.statMultiplier;
        const xpMult = this.xpMultiplier;
        const lootMult = this.lootMultiplier;
        
        if(statMult !== 1.0) {
            const pct = Math.round(statMult * 100);
            lines.push(`<div>Enemy Stats: <span class="text-danger">${pct}%</span></div>`);
        }
        if(xpMult !== 1.0) {
            const pct = Math.round(xpMult * 100);
            lines.push(`<div>XP Gained: <span class="text-success">${pct}%</span></div>`);
        }
        if(lootMult !== 1.0) {
            const pct = Math.round(lootMult * 100);
            lines.push(`<div>Loot Quantity: <span class="text-success">${pct}%</span></div>`);
        }
        
        // Show buff effects applied at dungeon start
        const dungeonStartBuffs = this.effects.filter(e => e.trigger === 'dungeon_start' && e.type === 'buff');
        if(dungeonStartBuffs.length > 0) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-info">Party Buffs:</div>');
            dungeonStartBuffs.forEach(effect => {
                const auraName = getAuraName(this.manager, effect.id);
                lines.push(`<div class="text-muted">• ${auraName} x${effect.getStacks()}</div>`);
            });
        }
        
        // Show enemy spawn effects
        const enemySpawnEffects = this.effects.filter(e => e.trigger === 'enemy_spawn');
        if(enemySpawnEffects.length > 0) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-warning">Enemy Effects:</div>');
            enemySpawnEffects.forEach(effect => {
                const auraName = getAuraName(this.manager, effect.id);
                const isBuffType = effect.type === 'buff';
                const typeLabel = isBuffType ? '' : '(debuff) ';
                lines.push(`<div class="text-muted">• ${typeLabel}${auraName} x${effect.getStacks()}</div>`);
            });
        }
        
        // Show special modes
        if(this.isEndless) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-info">Endless Mode: Enemies get stronger each wave!</div>');
        }
        
        return lines.join('');
    }
}

