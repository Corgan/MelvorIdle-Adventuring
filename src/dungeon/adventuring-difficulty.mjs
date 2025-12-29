const { loadModule } = mod.getContext(import.meta);

const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');

/**
 * Effect types for difficulties:
 * - enemy_stat_multiplier: Multiplies enemy stats by amount (1.5 = 150%)
 * - xp_multiplier: Multiplies XP gained by amount
 * - loot_multiplier: Multiplies loot quantity by amount
 * - buff: Apply a buff aura to party at dungeon start
 * - debuff: Apply a debuff to enemies at spawn
 * - enemy_buff: Apply a buff to enemies at spawn
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
        return this.waveGeneration?.type === 'infinite';
    }

    /**
     * Get floors per wave (default 1 for infinite modes)
     */
    get floorsPerWave() {
        return this.waveGeneration?.floorsPerWave ?? 1;
    }

    /**
     * Get floor selection strategy
     */
    get floorSelection() {
        return this.waveGeneration?.floorSelection ?? 'first';
    }

    get name() {
        return this._name;
    }

    get description() {
        return this._description;
    }

    get media() {
        return this.manager.getMediaURL(this._media || 'melvor:assets/media/main/question.png');
    }

    /**
     * Get all effects as StandardEffect objects for caching
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        return this.effects.map(effect => ({
            trigger: effect.trigger,
            type: effect.type,
            value: effect.amount?.base || effect.getAmount?.() || 1,
            stacks: effect.stacks?.base || effect.getStacks?.() || 1,
            aura: effect.id,  // For buff/debuff effects, this is the aura ID
            source: this,
            sourceName: this.name
        }));
    }

    /**
     * Get the stat multiplier from effects (default 1.0)
     */
    get statMultiplier() {
        const effect = this.effects.find(e => e.type === 'enemy_stat_multiplier');
        return effect && effect.amount ? effect.amount.base : 1.0;
    }

    /**
     * Get the XP multiplier from effects (default 1.0)
     */
    get xpMultiplier() {
        const effect = this.effects.find(e => e.type === 'xp_multiplier');
        return effect && effect.amount ? effect.amount.base : 1.0;
    }

    /**
     * Get the loot multiplier from effects (default 1.0)
     */
    get lootMultiplier() {
        const effect = this.effects.find(e => e.type === 'loot_multiplier');
        return effect && effect.amount ? effect.amount.base : 1.0;
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }

    /**
     * Check if this difficulty is unlocked for a given area
     * Normal difficulty is always unlocked, others require unlock_difficulty mastery effect
     * @param {AdventuringArea} area - The area to check unlock status for
     */
    isUnlocked(area) {
        // Normal difficulty (unlockLevel 0) is always available
        if (this.unlockLevel === 0) return true;
        
        // Check if area has the unlock_difficulty effect for this difficulty
        return area.masteryEffects.some(e => 
            e.type === 'unlock_difficulty' && e.difficultyID === this.id
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
            } else if(effect.type === 'enemy_buff') {
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
                const aura = this.manager.auras.getObjectByID(effect.id);
                if(aura) {
                    lines.push(`<div class="text-muted">• ${aura.name} x${effect.getStacks()}</div>`);
                }
            });
        }
        
        // Show enemy spawn effects
        const enemySpawnEffects = this.effects.filter(e => e.trigger === 'enemy_spawn');
        if(enemySpawnEffects.length > 0) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-warning">Enemy Effects:</div>');
            enemySpawnEffects.forEach(effect => {
                const aura = this.manager.auras.getObjectByID(effect.id);
                if(aura) {
                    const typeLabel = effect.type === 'enemy_buff' ? '' : '(debuff) ';
                    lines.push(`<div class="text-muted">• ${typeLabel}${aura.name} x${effect.getStacks()}</div>`);
                }
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

