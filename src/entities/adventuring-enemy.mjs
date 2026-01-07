const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');
const { UNKNOWN_MEDIA } = await loadModule('src/core/adventuring-utils.mjs');

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

            // New loot system: Currency always drops, salvage always drops with range, monster material occasionally drops
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
            
            // 1. Currency always drops
            const currencyEntry = lootTable.find(entry => entry.id === 'adventuring:currency');
            if(currencyEntry) {
                // Add slight variance: 80% to 120% of base qty
                const variance = 0.8 + (Math.random() * 0.4);
                const currencyQty = Math.max(1, Math.round(currencyEntry.qty * variance));
                processLoot(currencyEntry.id, currencyQty);
            }
            
            // 2. Salvage always drops with quantity range (1 to base qty)
            const salvageEntry = lootTable.find(entry => entry.id === 'adventuring:parts');
            if(salvageEntry) {
                // Random quantity from 1 to base qty
                const salvageQty = 1 + Math.floor(Math.random() * salvageEntry.qty);
                processLoot(salvageEntry.id, salvageQty);
            }
            
            // 3. Monster-specific materials have a chance to drop (based on their weight relative to total)
            const monsterMaterials = lootTable.filter(entry => 
                entry.id !== 'adventuring:currency' && entry.id !== 'adventuring:parts'
            );
            for(const material of monsterMaterials) {
                // Drop chance based on weight: weight / totalWeight gives original probability
                // We use weight / 100 as the drop chance (currency typically has weight 100)
                const dropChance = material.weight / 100;
                if(Math.random() < dropChance) {
                    processLoot(material.id, material.qty);
                }
            }
            
            // Apply drop rate bonus from monster mastery (chance for extra monster material drop)
            const dropRateBonus = this.manager.modifiers.getMonsterDropRateBonus(this.base);
            if(dropRateBonus > 0 && monsterMaterials.length > 0 && Math.random() < dropRateBonus) {
                // Pick a random monster material for bonus drop
                const bonusMaterial = monsterMaterials[Math.floor(Math.random() * monsterMaterials.length)];
                processLoot(bonusMaterial.id, bonusMaterial.qty);
            }
        }
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