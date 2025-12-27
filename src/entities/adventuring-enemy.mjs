const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/core/adventuring-character.mjs');

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

        // Get stat multiplier from dungeon effect cache (precompiled from difficulty + endless)
        const statMultiplier = this.manager.dungeon.effectCache.getEnemyStatMultiplier();

        monster.stats.forEach(({ id, value }) => {
            // Scale stats by cached multiplier
            const scaledValue = Math.floor(value * statMultiplier);
            this.stats.set(id, scaledValue);
        })
        this.stats.renderQueue.stats = true;

        // Get XP multiplier from dungeon effect cache (precompiled)
        const xpMultiplier = this.manager.dungeon.effectCache.getXPMultiplier();
        this.xp = Math.floor(monster.xp * xpMultiplier);
        
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
        const spawnEffects = this.manager.dungeon.effectCache.getEnemySpawnEffects();
        
        for(const effect of spawnEffects) {
            if(effect.type === 'debuff') {
                this.debuff(effect.aura, { 
                    stacks: effect.stacks, 
                    amount: effect.amount 
                }, null);
            } else if(effect.type === 'enemy_buff') {
                this.buff(effect.aura, { 
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
        return this.base !== undefined ? this.base.media : this.getMediaURL('melvor:assets/media/main/question.png');
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
        
        // Heal on phase transition
        if(phase.healPercent) {
            const healAmount = Math.floor(this.maxHitpoints * (phase.healPercent / 100));
            this.heal({ amount: healAmount });
            this.manager.log.add(`${this.base.name} heals for ${healAmount}!`);
        }
        
        // Apply phase aura/buff
        if(phase.aura) {
            this.auras.add(phase.aura);
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

            this.manager.party.all.filter(member => !member.dead).forEach(member => {
                if(member.combatJob.isMilestoneReward)
                    member.combatJob.addXP(bonusXP);

                member.equipment.slots.forEach((equipmentSlot, slotType) => {
                    if(!equipmentSlot.empty && !equipmentSlot.occupied) {
                        equipmentSlot.item.addXP(bonusXP);
                    }
                });
            });

            this.manager.dungeon.area.addXP(this.xp); // Mastery XP not boosted

            this.base.addXP(this.xp); // Monster mastery XP not boosted

            // Get loot with Monster Mastery bonuses
            let { id, qty } = this.base.lootGenerator.getEntry();
            
            // Apply drop rate bonus from monster mastery (chance for extra drop roll)
            const dropRateBonus = this.manager.modifiers.getMonsterDropRateBonus(this.base);
            if(dropRateBonus > 0 && Math.random() < dropRateBonus) {
                let bonus = this.base.lootGenerator.getEntry();
                if(bonus.id === id) {
                    qty += bonus.qty;
                } else {
                    this.manager.stash.add(bonus.id, bonus.qty);
                }
            }
            
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

            // Apply loot multiplier from dungeon effect cache (difficulty + endless combined)
            const lootMultiplier = this.manager.dungeon.effectCache.getLootMultiplier();
            if(lootMultiplier > 1) {
                qty = Math.ceil(qty * lootMultiplier);
            }
            
            this.manager.stash.add(id, qty);
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