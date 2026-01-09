const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { UNKNOWN_MEDIA, RequirementsChecker } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringEnemyRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
        this.card = false;
    }

    updateAll() {
        super.updateAll();
        this.card = true;
    }
}

export class AdventuringEnemy extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);

        this.renderQueue = new AdventuringEnemyRenderQueue();

        // Boss mechanics
        this.isBoss = false;
        this.currentPhase = 0;
        this.phases = [];
        this.isEnraged = false;
        this.enrageThreshold = 0;
        this.enrageBuff = null;
        this.phaseTransitioned = false;
    }

    setMonster(monster, spawned=true) {
        // Handle empty slot - no monster in this position
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

        // Reset boss state
        this.isBoss = monster.isBoss === true;
        this.currentPhase = 0;
        this.phases = monster.phases || [];
        this.isEnraged = false;
        this.enrageThreshold = monster.enrageThreshold || 0;
        this.enrageBuff = monster.enrageBuff || null;
        this.phaseTransitioned = false;

        // Get stat bonus from dungeon effect cache (additive percentages from difficulty + endless)
        const statBonus = this.manager.dungeon.getBonus('all_stat_percent', { target: 'all', party: 'enemy' });

        monster.stats.forEach(({ id, amount }) => {
            // Scale stats by bonus percentage
            const scaledValue = Math.floor(amount * (1 + statBonus / 100));
            this.stats.set(id, scaledValue);
        })
        this.stats.renderQueue.stats = true;

        // Get XP bonus from dungeon effect cache (additive percentage)
        const xpBonus = this.manager.dungeon.getBonus('xp_percent');
        this.xp = Math.floor(monster.xp * (1 + xpBonus / 100));
        
        this.setGenerator(this.manager.generators.getObjectByID(monster.generator));

        this.setSpender(this.manager.spenders.getObjectByID(monster.spender));

        if(spawned) {
            this.manager.bestiary.registerSeen(this.base);
            this.renderQueue.name = true;
            this.renderQueue.icon = true;
            
            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;

            this.energy = 0;
            this.renderQueue.energy = true;

            this.dead = false;

            this.component.splash.queue = [];
            
            // Apply enemy spawn effects from cached effect list
            this.applySpawnEffects();
        }
    }
    
    /**
     * Apply effects to this enemy at spawn (from dungeon effect cache)
     */
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
                // buff with party: 'enemy' applies to enemies
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

    /**
     * Check if boss should transition to next phase based on HP threshold
     */
    checkPhaseTransition() {
        if(!this.isBoss || this.phases.length <= 1) return;
        if(this.currentPhase >= this.phases.length - 1) return;
        
        const nextPhase = this.phases[this.currentPhase + 1];
        const hpPercent = (this.hitpoints / this.maxHitpoints) * 100;
        
        if(nextPhase.hpThreshold && hpPercent <= nextPhase.hpThreshold) {
            this.transitionToPhase(this.currentPhase + 1);
        }
    }

    /**
     * Transition to a new phase
     */
    transitionToPhase(phaseIndex) {
        if(phaseIndex >= this.phases.length) return;
        
        const phase = this.phases[phaseIndex];
        this.currentPhase = phaseIndex;
        this.phaseTransitioned = true;
        
        this.manager.log.add(`${this.base.name} enters Phase ${phaseIndex + 1}!`);
        
        // Apply phase-specific generator/spender
        if(phase.generator) {
            this.setGenerator(this.manager.generators.getObjectByID(phase.generator));
        }
        if(phase.spender) {
            this.setSpender(this.manager.spenders.getObjectByID(phase.spender));
        }
        
        // Apply phase stat buffs as auras
        if(phase.statBuffs) {
            phase.statBuffs.forEach(buff => {
                // Use the phase_buff aura for stat increases
                const buffPercent = Math.floor((buff.value || 0) * 100);
                if(buff.id === 'all' || buff.id === 'adventuring:all') {
                    // Generic stat buff to all stats
                    this.buff('adventuring:phase_buff', { amount: buffPercent }, this);
                } else if(buff.id.includes('strength') || buff.id.includes('ranged') || buff.id.includes('magic')) {
                    // Damage stat buff - use might
                    this.buff('adventuring:might', { amount: buffPercent }, this);
                } else if(buff.id.includes('agility')) {
                    // Speed stat buff - use haste
                    this.buff('adventuring:haste', { amount: buffPercent }, this);
                } else if(buff.id.includes('defence')) {
                    // Defense stat buff - use fortify
                    this.buff('adventuring:fortify', { amount: buffPercent }, this);
                }
            });
        }
        
        // Heal on phase transition (amount is whole number percent, e.g., 10 = 10%)
        if(phase.amount) {
            const healAmount = Math.floor(this.maxHitpoints * (phase.amount / 100));
            this.heal({ amount: healAmount });
            this.manager.log.add(`${this.base.name} heals for ${healAmount}!`);
        }
        
        // Apply phase aura/buff
        if(phase.aura) {
            this.auras.add(phase.aura, { stacks: 1 }, this);
        }
        
        this.renderQueue.name = true;
    }

    /**
     * Check if boss should enrage based on HP threshold
     */
    checkEnrage() {
        if(!this.isBoss || !this.enrageThreshold || this.isEnraged) return;
        
        const hpPercent = (this.hitpoints / this.maxHitpoints) * 100;
        
        if(hpPercent <= this.enrageThreshold) {
            this.triggerEnrage();
        }
    }

    /**
     * Trigger boss enrage
     */
    triggerEnrage() {
        this.isEnraged = true;
        this.manager.log.add(`${this.base.name} becomes ENRAGED!`);
        
        // Apply enrage as an aura with configurable amounts
        const enrageBuff = this.enrageBuff || { damage: 50, speed: 25 };
        
        // Apply the enrage aura with custom amounts
        this.buff('adventuring:enrage', { 
            amount: enrageBuff.damage || 50,
            stacks: 1
        }, this);
        
        this.renderQueue.name = true;
    }

    /**
     * Override damage to check for phase/enrage triggers
     */
    damage(hit, character) {
        super.damage(hit, character);
        
        if(this.isBoss && !this.dead) {
            this.checkPhaseTransition();
            this.checkEnrage();
        }
    }
    
    /**
     * Get all effect sources for a trigger type (overrides base to add monster passives)
     * @param {string} type - Trigger type
     * @param {object} context - Effect context
     * @returns {Array<{effect, source, sourceName, sourceType}>}
     */
    getAllPendingEffectsForTrigger(type, context) {
        // Get base effects (auras)
        const pending = super.getAllPendingEffectsForTrigger(type, context);
        
        // Add monster passives
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
            // Apply Dungeon Mastery XP bonus (from dungeon area milestones)
            const area = this.manager.dungeon.area;
            const bonuses = area ? area.getMasteryBonuses() : { xpBonus: 0 };
            const xpMultiplier = 1 + bonuses.xpBonus;
            const bonusXP = Math.ceil(this.xp * xpMultiplier);
            
            // Add skill XP with area as action for modifier query
            this.manager.addXP(bonusXP, area || this.base);

            // Job mastery XP from kills
            this.manager.party.all.filter(member => !member.dead).forEach(member => {
                if(member.combatJob.isMilestoneReward)
                    member.combatJob.addXP(bonusXP);
                
                // Note: Equipment XP is now granted from damage dealt, not kills
                // See adventuring-character.mjs damage() method
            });

            // Note: Area XP is now granted on dungeon clear, not per kill
            // See adventuring-dungeon.mjs onClear() method

            this.base.addXP(this.xp); // Monster mastery XP from kills

            // Type-based loot system: each entry has a type that determines processing
            const lootTable = this.base.lootGenerator.table;
            
            // Helper function to apply loot bonuses and add to stash
            const processLoot = (id, qty) => {
                // Apply drop quantity bonus from monster mastery
                const dropQtyBonus = this.manager.modifiers.getMonsterDropQtyBonus(this.base);
                if(dropQtyBonus > 0) {
                    qty = Math.ceil(qty * (1 + dropQtyBonus));
                }

                // Apply global material drop rate bonus from mastery pool
                const materialDropBonus = this.manager.modifiers.getMaterialDropRateBonus();
                if(materialDropBonus > 0) {
                    qty = Math.ceil(qty * (1 + materialDropBonus));
                }

                // Apply loot bonus from dungeon effect cache (additive percentage from difficulty + endless)
                const lootBonus = this.manager.dungeon.getBonus('loot_percent');
                if(lootBonus > 0) {
                    qty = Math.ceil(qty * (1 + lootBonus / 100));
                }
                
                this.manager.stash.add(id, qty);
            };
            
            // Helper to get quantity from entry (supports qty or minQty/maxQty)
            const getQty = (entry) => {
                if(entry.qty !== undefined) return entry.qty;
                if(entry.minQty !== undefined && entry.maxQty !== undefined) {
                    return entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
                }
                return 1;
            };
            
            // Helper to check if entry conditions are met
            const checkConditions = (entry) => {
                if(!entry.conditions || entry.conditions.length === 0) return true;
                const checker = new RequirementsChecker(this.manager, entry.conditions);
                return checker.check({});
            };
            
            // Helper to expand loot table references into entries
            const expandLootEntries = (entries) => {
                const expanded = [];
                for(const entry of entries) {
                    if(entry.type === 'table') {
                        // Reference to a named loot table
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
            
            // Expand any loot table references
            const expandedLoot = expandLootEntries(lootTable);

            // Process each loot entry by type
            for(const entry of expandedLoot) {
                // Check conditions first
                if(!checkConditions(entry)) continue;
                
                const lootType = (entry.type !== undefined) ? entry.type : this.inferLootType(entry);
                
                switch(lootType) {
                    case 'currency': {
                        // Currency always drops with variance (80-120%)
                        const baseQty = getQty(entry);
                        const variance = 0.8 + (Math.random() * 0.4);
                        const qty = Math.max(1, Math.round(baseQty * variance));
                        processLoot(entry.id, qty);
                        break;
                    }
                    
                    case 'salvage': {
                        // Salvage always drops with random quantity (1 to qty)
                        const baseQty = getQty(entry);
                        const qty = 1 + Math.floor(Math.random() * baseQty);
                        processLoot(entry.id, qty);
                        break;
                    }
                    
                    case 'materials': {
                        // Materials drop based on chance (0.0-1.0)
                        const dropChance = (entry.chance !== undefined) ? entry.chance : (entry.weight / 100);
                        if(Math.random() < dropChance) {
                            processLoot(entry.id, getQty(entry));
                        }
                        break;
                    }
                    
                    case 'equipment_pool': {
                        // Equipment pool drops from a configured pool
                        const pool = this.manager.equipmentPools.getObjectByID(entry.pool);
                        if(!pool) {
                            console.warn(`[Adventuring] Unknown equipment pool: ${entry.pool}`);
                            break;
                        }
                        
                        // Check if pool has any available (un-dropped) items
                        if(!pool.hasAvailable()) break;
                        
                        // Roll for drop chance
                        const dropChance = (entry.chance !== undefined) ? entry.chance : 0.1;
                        if(Math.random() < dropChance) {
                            const item = pool.roll();
                            if(item) {
                                // Pass rarity from entry or item for notification styling
                                const rarity = entry.rarity || item.rarity || null;
                                this.manager.armory.markDropped(item, true, rarity);
                            }
                        }
                        break;
                    }
                    
                    case 'equipment': {
                        // Specific equipment - one-time drop
                        const item = this.manager.baseItems.getObjectByID(entry.id);
                        if(!item) {
                            console.warn(`[Adventuring] Unknown equipment: ${entry.id}`);
                            break;
                        }
                        
                        // Check if already dropped
                        if(this.manager.armory.hasDropped(item)) break;
                        
                        // Roll for drop chance
                        const dropChance = (entry.chance !== undefined) ? entry.chance : 0.01;
                        if(Math.random() < dropChance) {
                            // Pass rarity from entry or item for notification styling
                            const rarity = entry.rarity || item.rarity || null;
                            this.manager.armory.markDropped(item, true, rarity);
                        }
                        break;
                    }
                }
            }
            
            // Apply drop rate bonus from monster mastery (chance for extra material drop)
            const dropRateBonus = this.manager.modifiers.getMonsterDropRateBonus(this.base);
            const materialEntries = lootTable.filter(e => ((e.type !== undefined) ? e.type : this.inferLootType(e)) === 'materials');
            if(dropRateBonus > 0 && materialEntries.length > 0 && Math.random() < dropRateBonus) {
                const bonusMaterial = materialEntries[Math.floor(Math.random() * materialEntries.length)];
                processLoot(bonusMaterial.id, getQty(bonusMaterial));
            }
        }
    }
    
    /**
     * Infer loot type from entry for backwards compatibility with old format.
     * New format entries should have explicit "type" field.
     * @param {Object} entry - Loot table entry
     * @returns {string} - Loot type: 'currency', 'salvage', 'materials', 'equipment_pool', or 'equipment'
     */
    inferLootType(entry) {
        // Explicit type takes precedence
        if(entry.type) return entry.type;
        
        // Infer from ID patterns (for backwards compatibility)
        if(entry.id === 'adventuring:currency') return 'currency';
        if(entry.id === 'adventuring:parts' || entry.id === 'adventuring:big_parts') return 'salvage';
        if(entry.pool) return 'equipment_pool';
        
        // Default to materials
        return 'materials';
    }
    
    render() {
        super.render();
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