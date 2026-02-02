const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { RequirementsChecker } = await loadModule('src/core/utils/requirements-checker.mjs');
const { UNKNOWN_MEDIA } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { StatBreakdownCache } = await loadModule('src/core/stats/adventuring-stat-breakdown.mjs');

class AdventuringEnemyRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
        this.card = false;
        this.iconTooltip = false;
    }

    updateAll() {
        super.updateAll();
        this.card = true;
        this.iconTooltip = true;
    }
}

export class AdventuringEnemy extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);

        this.renderQueue = new AdventuringEnemyRenderQueue();

        this.isBoss = false;
        this.currentPhase = 0;
        this.phases = [];
        this.isEnraged = false;
        this.enrageThreshold = 0;
        this.enrageBuff = null;
        this.phaseTransitioned = false;
        
        // Stat breakdown cache for tooltip display (enemies show combat effects only)
        this.statBreakdownCache = new StatBreakdownCache(this, manager);
    }

    initEffectCache() {
        super.initEffectCache();

        // Monster passive effects - queried dynamically based on current monster
        this.effectCache.registerSource('monsterPassives', () => {
            if (!this.base || !this.base.passives) return [];

            const effects = [];
            for (const passiveId of this.base.passives) {
                const passive = this.manager.passives.getObjectByID(passiveId);
                if (!passive || !passive.effects) continue;

                for (const effect of passive.effects) {
                    const effectObj = {
                        ...effect,
                        sourcePath: [{ type: 'monsterPassive', name: `${this.base.name} (${passive.name})`, ref: passive }]
                    };
                    // Preserve getAmount and getStacks methods if they exist
                    if (typeof effect.getAmount === 'function') {
                        effectObj.getAmount = effect.getAmount.bind(effect);
                    }
                    if (typeof effect.getStacks === 'function') {
                        effectObj.getStacks = effect.getStacks.bind(effect);
                    }
                    effects.push(effectObj);
                }
            }
            return effects;
        });

        // Difficulty effects (stat bonuses for enemies)
        this.effectCache.registerSource('difficulty', () => {
            const difficulty = this.manager.dungeon?.difficulty;
            if (!difficulty) return [];
            
            // Get effects that target enemies
            const allEffects = difficulty.getEffects();
            return allEffects.filter(e => 
                e.target === 'all' && e.party === 'enemy'
            );
        });

        // Shared encounter effects (environment + heroes targeting enemies)
        this.effectCache.registerSource('encounter', () => 
            this.manager.encounter?.getEffects() || []
        );
    }

    setMonster(monster, spawned=true) {

        // Invalidate monster passives cache when monster changes
        this.effectCache.invalidate('monsterPassives');

        if(monster === null || monster === undefined || monster === "") {
            this.base = undefined;
            this.dead = true;
            this.hitpoints = 0;
            this.energy = 0;
            this.isBoss = false;
            this.currentPhase = 0;
            this.phases = [];
            this.isEnraged = false;
            this.renderQueue.name = true;
            this.renderQueue.icon = true;
            this.renderQueue.hitpoints = true;
            this.renderQueue.energy = true;
            return;
        }

        if(typeof monster === "string")
            monster = this.manager.monsters.getObjectByID(monster);

        this.base = monster;
        this.renderQueue.name = true;
        this.renderQueue.icon = true;

        this.isBoss = monster.isBoss === true;
        this.currentPhase = 0;
        this.phases = monster.phases || [];
        this.isEnraged = false;
        this.enrageThreshold = monster.enrageThreshold || 0;
        this.enrageBuff = monster.enrageBuff || null;
        this.phaseTransitioned = false;

        const statBonus = this.manager.dungeon.getBonus('all_stat_percent', { target: 'all', party: 'enemy' });

        monster.stats.forEach(({ id, amount }) => {

            const scaledValue = Math.floor(amount * (1 + statBonus / 100));
            this.stats.set(id, scaledValue);
        })
        this.stats.renderQueue.stats = true;

        const xpBonus = this.manager.dungeon.getBonus('xp_percent');
        this.xp = Math.floor(monster.xp * (1 + xpBonus / 100));

        this.setGenerator(this.manager.generators.getObjectByID(monster.generator));

        this.setSpender(this.manager.spenders.getObjectByID(monster.spender));

        if(spawned) {
            this.manager.bestiary.registerSeen(this.base);
            this.renderQueue.name = true;
            this.renderQueue.icon = true;
            this.renderQueue.iconTooltip = true;

            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;

            this.energy = 0;
            this.renderQueue.energy = true;

            this.dead = false;

            this.component.splash.queue = [];

            // Trigger spawn effects via unified effect system
            this.trigger('enemy_spawn', {});
        }
    }

    get name() {
        let name = this.base !== undefined ? this.base.name : "???";
        if(this.isBoss && this.isEnraged) {
            name = `[ENRAGED] ${name}`;
        }
        if(this.isBoss && this.phases.length > 1) {
            name = `${name} (P${this.currentPhase + 1})`;
        }
        return name;
    }

    get media() {
        return this.base !== undefined ? this.base.media : this.getMediaURL(UNKNOWN_MEDIA);
    }

    getParty(type) {
        if (type === 'ally') return this.party;
        if (type === 'enemy') return this.manager.party;
        return null;
    }

    checkPhaseTransition() {
        if(!this.isBoss || this.phases.length <= 1) return;
        if(this.currentPhase >= this.phases.length - 1) return;

        const nextPhase = this.phases[this.currentPhase + 1];
        const hpPercent = (this.hitpoints / this.maxHitpoints) * 100;

        if(nextPhase.hpThreshold && hpPercent <= nextPhase.hpThreshold) {
            this.transitionToPhase(this.currentPhase + 1);
        }
    }

    transitionToPhase(phaseIndex) {
        if(phaseIndex >= this.phases.length) return;

        const phase = this.phases[phaseIndex];
        this.currentPhase = phaseIndex;
        this.phaseTransitioned = true;

        this.manager.log.add(`${this.getDisplayName()} enters Phase ${phaseIndex + 1}!`, {
            category: 'combat_mechanics',
            target: this
        });

        if(phase.generator) {
            this.setGenerator(this.manager.generators.getObjectByID(phase.generator));
        }
        if(phase.spender) {
            this.setSpender(this.manager.spenders.getObjectByID(phase.spender));
        }

        if(phase.statBuffs) {
            phase.statBuffs.forEach(buff => {

                const buffPercent = Math.floor((buff.value || 0) * 100);
                if(buff.id === 'all' || buff.id === 'adventuring:all') {

                    this.buff('adventuring:phase_buff', { amount: buffPercent }, this);
                } else if(buff.id.includes('strength') || buff.id.includes('ranged') || buff.id.includes('magic')) {

                    this.buff('adventuring:might', { amount: buffPercent }, this);
                } else if(buff.id.includes('agility')) {

                    this.buff('adventuring:haste', { amount: buffPercent }, this);
                } else if(buff.id.includes('defence')) {

                    this.buff('adventuring:fortify', { amount: buffPercent }, this);
                }
            });
        }

        if(phase.amount) {
            const healAmount = Math.floor(this.maxHitpoints * (phase.amount / 100));
            this.heal({ amount: healAmount });
            this.manager.log.add(`${this.getDisplayName()} heals for ${healAmount}!`, {
                category: 'combat_heal',
                target: this
            });
        }

        if(phase.aura) {
            this.auras.add(phase.aura, { stacks: 1 }, this);
        }

        this.renderQueue.name = true;
    }

    checkEnrage() {
        if(!this.isBoss || !this.enrageThreshold || this.isEnraged) return;

        const hpPercent = (this.hitpoints / this.maxHitpoints) * 100;

        if(hpPercent <= this.enrageThreshold) {
            this.triggerEnrage();
        }
    }

    triggerEnrage() {
        this.isEnraged = true;
        this.manager.log.add(`${this.getDisplayName()} becomes ENRAGED!`, {
            category: 'combat_mechanics',
            target: this
        });

        const enrageBuff = this.enrageBuff || { damage: 50, speed: 25 };

        this.buff('adventuring:enrage', {
            amount: enrageBuff.damage || 50,
            stacks: 1
        }, this);

        this.renderQueue.name = true;
    }

    damage(hit, character) {
        super.damage(hit, character);

        if(this.isBoss && !this.dead) {
            this.checkPhaseTransition();
            this.checkEnrage();
        }
    }

    /**
     * Calculate XP multiplier based on difficulty and mastery bonuses
     * @returns {number} The XP multiplier
     */
    _calculateXPMultiplier() {
        const area = this.manager.dungeon.area;
        const difficultyXPBonus = this.manager.dungeon.getBonus('xp_percent') / 100;
        const masteryBonuses = area ? area.masteryBonuses : { xpBonus: 0 };
        return 1 + difficultyXPBonus + masteryBonuses.xpBonus;
    }

    /**
     * Award skill and job XP on enemy death
     * @param {number} xpMultiplier - The XP multiplier to apply
     */
    _awardXP(xpMultiplier) {
        const area = this.manager.dungeon.area;
        const bonusXP = Math.ceil(this.xp * xpMultiplier);

        this.manager.addXP(bonusXP, area || this.base);
        this.manager.party.awardJobXP(bonusXP);
    }

    /**
     * Award mastery XP on enemy death
     * @param {number} xpMultiplier - The XP multiplier to apply
     */
    _awardMasteryXP(xpMultiplier) {
        const masteryXP = this.base.masteryXP || 25;
        const bonusMasteryXP = Math.ceil(masteryXP * xpMultiplier);
        this.base.addXP(bonusMasteryXP);

        // Update tooltip for all enemies of this type
        this.manager.encounter.party.all.forEach(enemy => {
            if(enemy.base === this.base) {
                enemy.renderQueue.iconTooltip = true;
            }
        });
    }

    /**
     * Apply quantity bonuses to loot drops
     * @param {string} id - The loot item ID
     * @param {number} qty - Base quantity
     * @param {boolean} isCurrency - Whether this is currency
     */
    _processLoot(id, qty, isCurrency = false) {
        const dropQtyBonus = this.manager.party.getMonsterDropQtyBonus(this.base);
        if(dropQtyBonus > 0) {
            qty = Math.ceil(qty * (1 + dropQtyBonus));
        }

        const materialDropBonus = this.manager.party.getMaterialDropRateBonus();
        if(materialDropBonus > 0) {
            qty = Math.ceil(qty * (1 + materialDropBonus));
        }

        if(isCurrency) {
            const currencyBonus = this.manager.party.getCurrencyDropBonus();
            if(currencyBonus > 0) {
                qty = Math.ceil(qty * (1 + currencyBonus));
            }
        }

        const lootBonus = this.manager.dungeon.getBonus('loot_percent');
        if(lootBonus > 0) {
            qty = Math.ceil(qty * (1 + lootBonus / 100));
        }

        this.manager.stash.add(id, qty, { fromCombat: true });
    }

    /**
     * Get quantity from a loot entry
     * @param {Object} entry - The loot entry
     * @returns {number} The quantity
     */
    _getLootQty(entry) {
        if(entry.qty !== undefined) return entry.qty;
        if(entry.minQty !== undefined && entry.maxQty !== undefined) {
            return entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
        }
        return 1;
    }

    /**
     * Check if loot entry conditions are met
     * @param {Object} entry - The loot entry
     * @returns {boolean} Whether conditions pass
     */
    _checkLootConditions(entry) {
        if(!entry.conditions || entry.conditions.length === 0) return true;
        const checker = new RequirementsChecker(this.manager, entry.conditions);
        return checker.check({});
    }

    /**
     * Expand loot table references into actual entries
     * @param {Array} entries - Raw loot entries
     * @returns {Array} Expanded entries
     */
    _expandLootEntries(entries) {
        const expanded = [];
        for(const entry of entries) {
            if(entry.type === 'table') {
                const table = this.manager.lootTables.getObjectByID(entry.table);
                if(table) {
                    expanded.push(...table.getEntries());
                } else {
                    console.warn(`[Adventuring] Unknown loot table: ${entry.table}`);
                }
            } else {
                expanded.push(entry);
            }
        }
        return expanded;
    }

    /**
     * Process a single loot entry
     * @param {Object} entry - The loot entry to process
     */
    _processLootEntry(entry) {
        if(!this._checkLootConditions(entry)) return;

        const lootType = (entry.type !== undefined) ? entry.type : this.inferLootType(entry);

        switch(lootType) {
            case 'currency': {
                const baseQty = this._getLootQty(entry);
                const variance = 0.8 + (Math.random() * 0.4);
                const qty = Math.max(1, Math.round(baseQty * variance));
                this._processLoot(entry.id, qty, true);
                break;
            }

            case 'salvage': {
                const baseQty = this._getLootQty(entry);
                const qty = 1 + Math.floor(Math.random() * baseQty);
                this._processLoot(entry.id, qty);
                break;
            }

            case 'materials': {
                const dropChance = (entry.chance !== undefined) ? entry.chance : (entry.weight / 100);
                if(Math.random() < dropChance) {
                    this._processLoot(entry.id, this._getLootQty(entry));
                }
                break;
            }

            case 'equipment_pool': {
                const pool = this.manager.equipmentPools.getObjectByID(entry.pool);
                if(!pool) {
                    console.warn(`[Adventuring] Unknown equipment pool: ${entry.pool}`);
                    break;
                }
                if(!pool.hasAvailable()) break;
                const dropChance = (entry.chance !== undefined) ? entry.chance : 0.1;
                if(Math.random() < dropChance) {
                    const item = pool.roll();
                    if(item) {
                        this.manager.armory.markDropped(item, true);
                    }
                }
                break;
            }

            case 'equipment': {
                const item = this.manager.baseItems.getObjectByID(entry.id);
                if(!item) {
                    console.warn(`[Adventuring] Unknown equipment: ${entry.id}`);
                    break;
                }
                if(this.manager.armory.hasDropped(item)) break;
                const dropChance = (entry.chance !== undefined) ? entry.chance : 0.01;
                if(Math.random() < dropChance) {
                    this.manager.armory.markDropped(item, true);
                }
                break;
            }
        }
    }

    /**
     * Process all loot drops on death
     */
    _processLootDrops() {
        const lootTable = this.base.lootGenerator.table;
        const expandedLoot = this._expandLootEntries(lootTable);

        for(const entry of expandedLoot) {
            this._processLootEntry(entry);
        }

        // Bonus material drop from mastery
        const dropRateBonus = this.manager.party.getMonsterDropRateBonus(this.base);
        const materialEntries = lootTable.filter(e => 
            ((e.type !== undefined) ? e.type : this.inferLootType(e)) === 'materials'
        );
        if(dropRateBonus > 0 && materialEntries.length > 0 && Math.random() < dropRateBonus) {
            const bonusMaterial = materialEntries[Math.floor(Math.random() * materialEntries.length)];
            this._processLoot(bonusMaterial.id, this._getLootQty(bonusMaterial));
        }
    }

    onDeath() {
        super.onDeath();
        if(!this.xp) return;

        const xpMultiplier = this._calculateXPMultiplier();
        this._awardXP(xpMultiplier);
        this._awardMasteryXP(xpMultiplier);
        this._processLootDrops();
    }

    inferLootType(entry) {

        if(entry.type) return entry.type;

        if(entry.id === 'adventuring:currency') return 'currency';
        if(entry.id === 'adventuring:parts' || entry.id === 'adventuring:big_parts') return 'salvage';
        if(entry.pool) return 'equipment_pool';

        return 'materials';
    }

    render() {
        super.render();
        this.renderIconTooltip();
    }

    renderIconTooltip() {
        if(!this.renderQueue.iconTooltip)
            return;

        if(!this.base) {
            this.component.setIconTooltipContent('');
            this.renderQueue.iconTooltip = false;
            return;
        }

        const killCount = this.manager.bestiary.getKillCount(this.base);

        const tooltip = TooltipBuilder.create()
            .header(this.base.name, this.base.media)
            .stat('Kills', killCount.toLocaleString())
            .masteryProgressFor(this.manager, this.base);

        this.component.setIconTooltipContent(tooltip.build());
        this.renderQueue.iconTooltip = false;
    }

    encode(writer) {
        super.encode(writer);

        writer.writeBoolean(this.base !== undefined);
        if (this.base !== undefined)
            writer.writeNamespacedObject(this.base);
        return writer;
    }

    decode(reader, version) {
        super.decode(reader, version);
        if (reader.getBoolean()) {
            const base = reader.getNamespacedObject(this.manager.monsters);
            this.setMonster(base, false);
        }
    }
}