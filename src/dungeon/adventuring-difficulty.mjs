const { loadModule } = mod.getContext(import.meta);

const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { getAuraName, UNKNOWN_MEDIA, describeEffectsInline } = await loadModule('src/core/adventuring-utils.mjs');

class DifficultyEffect extends AdventuringScalableEffect {
    constructor(manager, game, difficulty, data) {
        super(manager, game, data);
        this.difficulty = difficulty;
        this.trigger = data.trigger || 'passive'; // 'passive', 'dungeon_start', 'enemy_spawn'
    }
}

export class AdventuringDifficulty extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._description = data.description || '';
        this._media = data.media;
        this.color = data.color || 'text-white';
        this.unlockLevel = data.unlockLevel || 0;
        this.isEndless = data.isEndless === true;
        this.waveScaling = data.waveScaling || null;
        this.waveGeneration = data.waveGeneration || null;
        this.effects = (data.effects || []).map(effect =>
            new DifficultyEffect(this.manager, this.game, this, effect)
        );
    }

    get isInfinite() {
        return this.waveGeneration && this.waveGeneration.type === 'infinite';
    }

    get floorsPerWave() {
        return this.waveGeneration && this.waveGeneration.floorsPerWave !== undefined ? this.waveGeneration.floorsPerWave : 1;
    }

    get floorSelection() {
        return this.waveGeneration && this.waveGeneration.floorSelection !== undefined ? this.waveGeneration.floorSelection : 'first';
    }

    get name() {
        return this._name;
    }

    get description() {
        if (this._description) return this._description;
        return describeEffectsInline(this.effects, this.manager) || 'No modifiers';
    }

    get media() {
        return this.manager.getMediaURL(this._media || UNKNOWN_MEDIA);
    }

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

    get enemyStatsPercent() {
        const effect = this.effects.find(e =>
            e.type === 'all_stat_percent' && e.party === 'enemy'
        );
        return effect && effect.amount ? effect.amount.base : 0;
    }

    get statMultiplier() {
        return 1 + (this.enemyStatsPercent / 100);
    }

    get xpPercent() {
        const effect = this.effects.find(e => e.type === 'xp_percent');
        return effect && effect.amount ? effect.amount.base : 0;
    }

    get xpMultiplier() {
        return 1 + (this.xpPercent / 100);
    }

    get lootPercent() {
        const effect = this.effects.find(e => e.type === 'loot_percent');
        return effect && effect.amount ? effect.amount.base : 0;
    }

    get lootMultiplier() {
        return 1 + (this.lootPercent / 100);
    }

    getWaveMultiplier(waveNumber) {
        let totalPercent = this.enemyStatsPercent;

        if (waveNumber > 0 && this.waveScaling) {
            const perWave = this.waveScaling.statPercentPerWave ?? 5;
            totalPercent += waveNumber * perWave;
        }

        return 1 + (totalPercent / 100);
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }

    isUnlocked(area) {
        if (this.unlockLevel === 0) return true;
        return area.masteryEffects.some(e =>
            e.type === 'unlock' && e.unlockType === 'difficulty' && e.difficultyID === this.id
        );
    }

    onDungeonStart(dungeon) {
        this.effects.forEach(effect => {
            if(effect.trigger !== 'dungeon_start') return;

            if(effect.type === 'buff') {
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

    onEnemySpawn(enemy, dungeon) {
        this.effects.forEach(effect => {
            if(effect.trigger !== 'enemy_spawn') return;

            if(effect.type === 'debuff') {
                enemy.debuff(effect.id, {
                    stacks: effect.getStacks(),
                    amount: effect.getAmount()
                }, null);
            } else if(effect.type === 'buff' && effect.party === 'enemy') {
                enemy.buff(effect.id, {
                    stacks: effect.getStacks(),
                    amount: effect.getAmount()
                }, null);
            }
        });
    }

    getEffectsOfType(type) {
        return this.effects.filter(e => e.type === type);
    }

    get tooltip() {
        const lines = [];
        lines.push(`<div class="font-w700 ${this.color}">${this.name}</div>`);

        if(this.description) {
            lines.push(`<div class="text-muted">${this.description}</div>`);
        }

        lines.push('<hr class="my-1">');
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
        const dungeonStartBuffs = this.effects.filter(e => e.trigger === 'dungeon_start' && e.type === 'buff');
        if(dungeonStartBuffs.length > 0) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-info">Party Buffs:</div>');
            dungeonStartBuffs.forEach(effect => {
                const auraName = getAuraName(this.manager, effect.id);
                lines.push(`<div class="text-muted">• ${auraName} x${effect.getStacks()}</div>`);
            });
        }
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
        if(this.isEndless) {
            lines.push('<hr class="my-1">');
            lines.push('<div class="text-info">Endless Mode: Enemies get stronger each wave!</div>');
        }

        return lines.join('');
    }
}

