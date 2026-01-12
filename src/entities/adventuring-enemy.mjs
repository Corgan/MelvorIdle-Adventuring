const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { UNKNOWN_MEDIA, RequirementsChecker } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

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
    }

    setMonster(monster, spawned=true) {

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

            this.applySpawnEffects();
        }
    }

    applySpawnEffects() {
        const spawnEffects = this.manager.dungeon.getEffectsForTrigger('enemy_spawn');

        for(const effect of spawnEffects) {
            const auraId = effect.id;
            if(!auraId) continue; // Skip effects without valid aura ID

            if(effect.type === 'debuff') {
                this.debuff(auraId, {
                    stacks: effect.stacks,
                    amount: effect.amount
                }, null);
            } else if(effect.type === 'buff' && effect.party === 'enemy') {

                this.buff(auraId, {
                    stacks: effect.stacks,
                    amount: effect.amount
                }, null);
            }
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

        this.manager.log.add(`${this.base.name} enters Phase ${phaseIndex + 1}!`);

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
            this.manager.log.add(`${this.base.name} heals for ${healAmount}!`);
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
        this.manager.log.add(`${this.base.name} becomes ENRAGED!`);

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

    getAllPendingEffectsForTrigger(type, context) {

        const pending = super.getAllPendingEffectsForTrigger(type, context);

        if (this.base && this.base.passives) {
            for (const passiveId of this.base.passives) {
                const passive = this.manager.passives.getObjectByID(passiveId);
                if (!passive || !passive.effects) continue;

                for (const effect of passive.effects) {
                    if (effect.trigger === type) {
                        pending.push({
                            effect,
                            source: passive,
                            sourceName: `${this.base.name} (${passive.name})`,
                            sourceType: 'monsterPassive'
                        });
                    }
                }
            }
        }

        return pending;
    }

    onDeath() {
        super.onDeath();
        if(this.xp) {

            const area = this.manager.dungeon.area;
            const difficultyXPBonus = this.manager.dungeon.getBonus('xp_percent') / 100;
            const masteryBonuses = area ? area.getMasteryBonuses() : { xpBonus: 0 };
            const xpMultiplier = 1 + difficultyXPBonus + masteryBonuses.xpBonus;
            const bonusXP = Math.ceil(this.xp * xpMultiplier);

            this.manager.addXP(bonusXP, area || this.base);

            this.manager.party.all.forEach(member => {
                if(member.combatJob.isMilestoneReward)
                    member.combatJob.addXP(bonusXP);
            });

            const masteryXP = this.base.masteryXP || 25;
            const bonusMasteryXP = Math.ceil(masteryXP * xpMultiplier);
            this.base.addXP(bonusMasteryXP);

            this.manager.encounter.party.all.forEach(enemy => {
                if(enemy.base === this.base) {
                    enemy.renderQueue.iconTooltip = true;
                }
            });

            const lootTable = this.base.lootGenerator.table;

            const processLoot = (id, qty) => {

                const dropQtyBonus = this.manager.modifiers.getMonsterDropQtyBonus(this.base);
                if(dropQtyBonus > 0) {
                    qty = Math.ceil(qty * (1 + dropQtyBonus));
                }

                const materialDropBonus = this.manager.modifiers.getMaterialDropRateBonus();
                if(materialDropBonus > 0) {
                    qty = Math.ceil(qty * (1 + materialDropBonus));
                }

                const lootBonus = this.manager.dungeon.getBonus('loot_percent');
                if(lootBonus > 0) {
                    qty = Math.ceil(qty * (1 + lootBonus / 100));
                }

                this.manager.stash.add(id, qty);
            };

            const getQty = (entry) => {
                if(entry.qty !== undefined) return entry.qty;
                if(entry.minQty !== undefined && entry.maxQty !== undefined) {
                    return entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
                }
                return 1;
            };

            const checkConditions = (entry) => {
                if(!entry.conditions || entry.conditions.length === 0) return true;
                const checker = new RequirementsChecker(this.manager, entry.conditions);
                return checker.check({});
            };

            const expandLootEntries = (entries) => {
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
            };

            const expandedLoot = expandLootEntries(lootTable);

            for(const entry of expandedLoot) {

                if(!checkConditions(entry)) continue;

                const lootType = (entry.type !== undefined) ? entry.type : this.inferLootType(entry);

                switch(lootType) {
                    case 'currency': {

                        const baseQty = getQty(entry);
                        const variance = 0.8 + (Math.random() * 0.4);
                        const qty = Math.max(1, Math.round(baseQty * variance));
                        processLoot(entry.id, qty);
                        break;
                    }

                    case 'salvage': {

                        const baseQty = getQty(entry);
                        const qty = 1 + Math.floor(Math.random() * baseQty);
                        processLoot(entry.id, qty);
                        break;
                    }

                    case 'materials': {

                        const dropChance = (entry.chance !== undefined) ? entry.chance : (entry.weight / 100);
                        if(Math.random() < dropChance) {
                            processLoot(entry.id, getQty(entry));
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

                                const rarity = entry.rarity || item.rarity || null;
                                this.manager.armory.markDropped(item, true, rarity);
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

                            const rarity = entry.rarity || item.rarity || null;
                            this.manager.armory.markDropped(item, true, rarity);
                        }
                        break;
                    }
                }
            }

            const dropRateBonus = this.manager.modifiers.getMonsterDropRateBonus(this.base);
            const materialEntries = lootTable.filter(e => ((e.type !== undefined) ? e.type : this.inferLootType(e)) === 'materials');
            if(dropRateBonus > 0 && materialEntries.length > 0 && Math.random() < dropRateBonus) {
                const bonusMaterial = materialEntries[Math.floor(Math.random() * materialEntries.length)];
                processLoot(bonusMaterial.id, getQty(bonusMaterial));
            }
        }
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