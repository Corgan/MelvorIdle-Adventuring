const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringGenerator } = await loadModule('src/dungeon/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/town/adventuring-spender.mjs');
const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/dungeon/adventuring-dungeon-floor.mjs');

const { AdventuringEnemy } = await loadModule('src/entities/adventuring-enemy.mjs');
const { AdventuringHero } = await loadModule('src/entities/adventuring-hero.mjs');

const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/entities/adventuring-party.mjs');

const { AdventuringEncounterElement } = await loadModule('src/combat/components/adventuring-encounter.mjs');
const { AdventuringPartyElement } = await loadModule('src/entities/components/adventuring-party.mjs');

export class AdventuringEncounter extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.isFighting = false;
        this.hitHistory = [];
        this.currentRoundOrder = [];
        this.nextRoundOrder = [];
        this.roundCounter = 0;
        this.currentHit = 0;
        this.hitRepeat = 0;

        this.component = createElement('adventuring-encounter');

        this.party = new AdventuringEnemyParty(this.manager, this.game);
        this.party.component.mount(this.component.enemies);

        this.roundCard = new AdventuringCard(this.manager, this.game);
        
        this.turnTimer = new Timer('Turn', () => this.processTurn());
        this.turnInterval = 1500;

        this.hitTimer = new Timer('Hit', () => this.processHit());
        this.hitInterval = 150;
        this.endTurnInterval = 100;
    }

    get all() {
        return [...this.manager.party.all, ...this.party.all];
    }

    get currentTimer() {
        if(this.hitTimer.isActive)
            return this.hitTimer;
        return this.turnTimer;
    }

    onLoad() {
        super.onLoad();
        this.party.onLoad();
    }

    generateEncounter(isExit=false) {
        let group;

        if(!isExit) {
            group = [
                this.manager.dungeon.groupGenerator.getEntry().id,
                this.manager.dungeon.groupGenerator.getEntry().id,
                this.manager.dungeon.groupGenerator.getEntry().id
            ];
        } else {
            group = this.manager.dungeon.currentFloor.exit;
        }

        this.party.front.setMonster(group[0]);
        this.party.center.setMonster(group[1]);
        this.party.back.setMonster(group[2]);
    }

    startEncounter() {
        this.currentRoundOrder = [...this.all].filter(c => !c.dead).sort((a,b) => {
            let agility = this.manager.stats.getObjectByID("adventuring:agility");
            return b.getEffectiveStat(agility) - a.getEffectiveStat(agility);
        });
        this.nextRoundOrder = [];
        this.roundCounter = 1;
        this.isFighting = true;

        // Apply bonus starting energy from mastery pool
        const bonusEnergy = this.manager.modifiers.getBonusEnergy();
        if(bonusEnergy > 0) {
            this.manager.party.all.forEach(member => {
                if(!member.dead && member.maxEnergy > 0) {
                    member.addEnergy(bonusEnergy);
                }
            });
        }

        // Apply consumable effects at encounter start
        this.manager.consumables.onEncounterStart();

        // Apply job passives at encounter start
        this.manager.party.all.forEach(member => {
            this.applyJobPassives(member, 'encounter_start');
        });

        // Apply monster passives at encounter start
        this.party.all.forEach(enemy => {
            this.applyMonsterPassives(enemy, 'encounter_start');
        });

        this.all.forEach(member => {
            let resolvedEffects = member.trigger('encounter_start');
        });

        // Also trigger round_start for the first round
        this.manager.party.all.forEach(member => {
            this.applyJobPassives(member, 'round_start');
        });

        // Trigger tutorial for first combat
        this.manager.tutorialManager.checkTriggers('event', { event: 'combatStart' });

        this.party.all.forEach(enemy => {
            this.applyMonsterPassives(enemy, 'round_start');
        });

        this.all.forEach(member => {
            let resolvedEffects = member.trigger('round_start');
        });

        this.nextTurn();
        
        if(this.manager.dungeon.active)
            this.manager.encounter.go();
    }

    reset() {
        this.currentTurn = undefined;
        this.currentAction = undefined;
        this.currentHit = 0;
        this.hitRepeat = 0;
        this.isEchoAction = false;

        this.currentRoundOrder = [];
        this.nextRoundOrder = [];
        this.roundCounter = 0;
        this.isFighting = false;
        this.turnTimer.stop();
        this.hitTimer.stop();
        this.manager.overview.renderQueue.turnProgressBar = true;
        this.updateTurnCards();
    }

    removeDead() {
        this.currentRoundOrder = this.currentRoundOrder.filter(character => character.hitpoints > 0 && !character.dead);
        this.nextRoundOrder = this.nextRoundOrder.filter(character => character.hitpoints > 0 && !character.dead);
    }

    nextRound() {
        this.all.forEach(member => {
            let resolvedEffects = member.trigger('round_end');
        });

        this.currentRoundOrder = this.nextRoundOrder;
        this.nextRoundOrder = [];
        this.roundCounter++;
        this.manager.overview.renderQueue.status = true;

        // Apply job passives at round start
        this.manager.party.all.forEach(member => {
            this.applyJobPassives(member, 'round_start');
        });

        // Apply monster passives at round start
        this.party.all.forEach(enemy => {
            this.applyMonsterPassives(enemy, 'round_start');
        });

        this.all.forEach(member => {
            let resolvedEffects = member.trigger('round_start');
        });
    }

    nextTurn() {
        this.currentTurn = this.currentRoundOrder.shift();
        
        this.turnTimer.start(this.turnInterval);
        
        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;
        this.updateTurnCards();
    }

    processTurn() {
        // If timers are paused (e.g., tutorial informational step), restart timer and wait
        if(this.manager.timersPaused) {
            this.turnTimer.start(this.turnInterval);
            return;
        }
        
        this.currentAction = this.currentTurn.action;
        this.currentHit = 0;
        this.hitRepeat = 0;
        this.hitHistory = [];
        
        // Apply job passives at turn start (if current turn is a hero)
        if(this.manager.party.all.includes(this.currentTurn)) {
            this.applyJobPassives(this.currentTurn, 'turn_start');
        } else {
            // Apply monster passives at turn start
            this.applyMonsterPassives(this.currentTurn, 'turn_start');
        }
        
        let resolvedEffects = this.currentTurn.trigger('turn_start', { skip: false });

        if(this.currentTurn.dead || resolvedEffects.skip === true) {
            this.endTurn();
            return;
        }

        let currentHit = this.currentAction.hits[this.currentHit]; 
        if(currentHit !== undefined) {
            this.hitTimer.start(currentHit.delay !== undefined ? currentHit.delay : this.hitInterval);
            this.manager.overview.renderQueue.turnProgressBar = true;
            this.updateTurnCards();
        } else {
            this.processHit();
        }
    }

    processHit() {
        if(this.currentHit >= this.currentAction.hits.length) {
            this.endTurn();
            return;
        }
        
        let currentHit = this.currentAction.hits[this.currentHit];

        let effectParty = currentHit.party;
        let targetType = currentHit.target;

        let targetParty;

        if(this.currentTurn instanceof AdventuringHero) {
            if(effectParty === "ally") {
                targetParty = this.manager.party;
            } else if(effectParty === "enemy") {
                targetParty = this.party;
            }
        } else if (this.currentTurn instanceof AdventuringEnemy) {
            if(effectParty === "ally") {
                targetParty = this.party;
            } else if(effectParty === "enemy") {
                targetParty = this.manager.party;
            }
        }

        let targets = [];
        if(targetType === "none") {
            targets = [];
        } else if(targetType === "front") {
            if(!targetParty.back.dead)
                targets = [targetParty.back];
            if(!targetParty.center.dead)
                targets = [targetParty.center];
            if(!targetParty.front.dead)
                targets = [targetParty.front];
        } else if(targetType === "back") {
            if(!targetParty.front.dead)
                targets = [targetParty.front];
            if(!targetParty.center.dead)
                targets = [targetParty.center];
            if(!targetParty.back.dead)
                targets = [targetParty.back];
        } else if(targetType === "random") {
            let potentialTargets = targetParty.all.filter(target => !target.dead);
            targets = [potentialTargets[Math.floor(Math.random()*potentialTargets.length)]];
        } else if(targetType === "aoe") {
            targets = targetParty.all.filter(target => !target.dead);
        } else if(targetType === "lowest") {
            let aliveTargets = targetParty.all.filter(target => !target.dead);
            if (aliveTargets.length > 0) {
                let potentialTargets = aliveTargets.reduce((lowest, target) => {
                    if(lowest === undefined || lowest.hitpointsPercent > target.hitpointsPercent)
                        lowest = target;
                    return lowest;
                });
                targets = [potentialTargets];
            }
        } else if(targetType === "self") {
            targets = [this.currentTurn];
        } else if(targetType === "dead") {
            // For revive abilities - find dead allies
            targets = targetParty.all.filter(target => target.dead);
        }

        // Check for taunt (force_target) - only for enemy targeting
        if(effectParty === "enemy" && targets.length > 0) {
            let tauntCheck = this.currentTurn.trigger('targeting', {});
            if(tauntCheck.forcedTarget && !tauntCheck.forcedTarget.dead) {
                targets = [tauntCheck.forcedTarget];
                this.manager.log.add(`${this.currentTurn.name} is forced to attack ${tauntCheck.forcedTarget.name}!`);
            }
        }

        // Check for confusion (chance_hit_ally) - swap target to ally
        if(effectParty === "enemy" && targets.length > 0) {
            let confuseCheck = this.currentTurn.trigger('targeting', {});
            if(confuseCheck.hitAlly) {
                // Get current turn's party
                let allyParty = this.currentTurn instanceof AdventuringHero ? this.manager.party : this.party;
                let potentialAllies = allyParty.all.filter(ally => !ally.dead && ally !== this.currentTurn);
                if(potentialAllies.length > 0) {
                    targets = [potentialAllies[Math.floor(Math.random() * potentialAllies.length)]];
                }
            }
        }

        if(targets.length > 0) {
            this.currentTurn.trigger('before_ability_cast', { targets: targets });

            targets.forEach(target => {
                if(target !== undefined) {
                    this.currentTurn.trigger('before_hit_delivered', { target: target });
                    target.trigger('before_hit_received', { attacker: this.currentTurn });

                    currentHit.effects.forEach(effect => {
                        let builtEffect = {
                            amount: effect.getAmount(this.currentTurn)
                        };
                        
                        if(effect.stacks !== undefined)
                            builtEffect.stacks = effect.getStacks(this.currentTurn);

                        let isCrit = false;
                        
                        if(effect.type === "damage" || effect.type === "heal") {
                            if(effect.type === "damage") {
                                // Check for miss (Blind debuff)
                                let missCheck = this.currentTurn.trigger('before_damage_delivered', { target: target, ...builtEffect });
                                // Also trigger before_damage_dealt for consumables that use this naming
                                missCheck = this.currentTurn.trigger('before_damage_dealt', { target: target, ...missCheck });
                                if(missCheck.missed) {
                                    this.manager.log.add(`${this.currentTurn.name}'s attack misses ${target.name}!`);
                                    return; // Skip this effect
                                }
                                builtEffect = missCheck;
                                
                                // Check for dodge (Evasion buff)
                                let dodgeCheck = target.trigger('before_damage_received', { attacker: this.currentTurn, ...builtEffect });
                                if(dodgeCheck.dodged) {
                                    return; // Skip this effect
                                }
                                builtEffect = dodgeCheck;
                                
                                // Apply damage bonus from passive effects
                                const damageBonus = this.currentTurn.getPassiveBonus('damage_bonus');
                                if(damageBonus > 0) {
                                    builtEffect.amount = Math.ceil(builtEffect.amount * (1 + damageBonus / 100));
                                }
                                
                                // Apply damage reduction from target's passive effects
                                const damageReduction = target.getPassiveBonus('damage_reduction');
                                if(damageReduction > 0) {
                                    builtEffect.amount = Math.ceil(builtEffect.amount * (1 - damageReduction / 100));
                                }
                                
                                // Critical hit check
                                const critChance = this.currentTurn.getPassiveBonus('crit_chance');
                                if(critChance > 0 && Math.random() * 100 < critChance) {
                                    isCrit = true;
                                    // Base crit is 1.5x, plus any crit_damage bonus
                                    const critDamageBonus = this.currentTurn.getPassiveBonus('crit_damage');
                                    const critMultiplier = 1.5 + (critDamageBonus / 100);
                                    builtEffect.amount = Math.ceil(builtEffect.amount * critMultiplier);
                                }
                            } else if (effect.type === "heal") {
                                // Apply healing bonus from caster
                                const healingBonus = this.currentTurn.getPassiveBonus('healing_bonus');
                                if(healingBonus > 0) {
                                    builtEffect.amount = Math.ceil(builtEffect.amount * (1 + healingBonus / 100));
                                }
                                
                                // Apply healing received bonus to target
                                const healingReceived = target.getPassiveBonus('healing_received');
                                if(healingReceived > 0) {
                                    builtEffect.amount = Math.ceil(builtEffect.amount * (1 + healingReceived / 100));
                                }
                                
                                builtEffect = this.currentTurn.trigger('before_heal_delivered', { target: target, ...builtEffect });
                                builtEffect = target.trigger('before_heal_received', { attacker: this.currentTurn, ...builtEffect });
                            }
                        }

                        // Track damage for lifesteal
                        let damageDealt = effect.type === "damage" ? builtEffect.amount : 0;

                        if(effect.type === "damage" || effect.type === "heal") {
                            const critText = isCrit ? ' (CRIT!)' : '';
                            this.manager.log.add(`${this.currentTurn.name} ${effect.type}s ${target.name} with ${this.currentAction.name} for ${builtEffect.amount}${critText}`);
                        }
                        
                        target.applyEffect(effect, builtEffect, this.currentTurn);
                        
                        if(effect.type === "damage" || effect.type === "heal") {
                            if(effect.type === "damage") {
                                // Trigger on_crit if this was a critical hit
                                if(isCrit) {
                                    this.currentTurn.trigger('on_crit', { target: target, damageDealt: damageDealt });
                                }
                                
                                builtEffect = target.trigger('after_damage_received', { attacker: this.currentTurn, damageReceived: damageDealt, ...builtEffect });
                                
                                // Check execute threshold
                                const executeThreshold = this.currentTurn.getPassiveBonus('execute');
                                if(executeThreshold > 0 && !target.dead && target.hitpointsPercent < executeThreshold) {
                                    this.manager.log.add(`${this.currentTurn.name} executes ${target.name}!`);
                                    target.hitpoints = 0;
                                    target.damage({ amount: 0 }, this.currentTurn); // Trigger death
                                }
                                
                                // Check reflect damage
                                const reflectDamage = target.getPassiveBonus('reflect_damage');
                                if(reflectDamage > 0 && damageDealt > 0) {
                                    const reflectAmount = Math.ceil(damageDealt * (reflectDamage / 100));
                                    this.currentTurn.damage({ amount: reflectAmount }, target);
                                    this.manager.log.add(`${target.name} reflects ${reflectAmount} damage to ${this.currentTurn.name}!`);
                                }
                                
                                // Trigger lifesteal with damage dealt
                                builtEffect = this.currentTurn.trigger('after_damage_delivered', { target: target, damageDealt: damageDealt, ...builtEffect });
                                // Also trigger after_damage_dealt for consumables that use this naming
                                builtEffect = this.currentTurn.trigger('after_damage_dealt', { target: target, damageDealt: damageDealt, ...builtEffect });
                                
                                // Check if target died and trigger on_kill
                                if(target.dead) {
                                    this.currentTurn.trigger('on_kill', { target: target, damageDealt: damageDealt });
                                }
                            } else if (effect.type === "heal") {
                                builtEffect = target.trigger('after_heal_received', { attacker: this.currentTurn, ...builtEffect });
                                builtEffect = this.currentTurn.trigger('after_heal_delivered', { target: target, ...builtEffect });
                            }
                        }
                    });

                    target.trigger('after_hit_received', { attacker: this.currentTurn });
                    this.currentTurn.trigger('after_hit_delivered', { targets: targets });
                }
            });
            
            this.currentTurn.trigger('after_ability_cast', { targets: targets });
            this.hitHistory.push(targets);
        }

        if(currentHit.energy !== undefined) {
            // Apply energy gain bonus modifier
            const energyBonus = this.currentTurn.getPassiveBonus('energy_gain_bonus');
            const bonusEnergy = Math.floor(currentHit.energy * (energyBonus / 100));
            this.currentTurn.addEnergy(currentHit.energy + bonusEnergy);
        }

        if(currentHit.repeat === undefined || ++this.hitRepeat >= currentHit.repeat)
            this.currentHit++;

        let endTurnDelay = this.endTurnInterval;

        let nextHit = this.currentAction.hits[this.currentHit];
        if(nextHit !== undefined) {
            if(nextHit.delay !== undefined)
                endTurnDelay = nextHit.delay;
        }

        if(endTurnDelay === 0) {
            this.processHit();
        } else {
            this.hitTimer.start(endTurnDelay);
        }
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    endTurn() {
        // Check spell echo BEFORE consuming energy (spenders only)
        const isSpender = this.currentAction.cost !== undefined && this.currentAction.cost > 0;
        let shouldEcho = false;
        
        if(isSpender && !this.isEchoAction) {
            const spellEchoChance = this.currentTurn.getPassiveBonus('spell_echo');
            if(spellEchoChance > 0 && Math.random() * 100 < spellEchoChance) {
                shouldEcho = true;
                this.manager.log.add(`${this.currentTurn.name}'s spell echoes!`);
            }
        }
        
        // Apply cost reduction for spenders
        if(this.currentAction.cost !== undefined && this.currentAction.cost > 0) {
            const costReduction = this.currentTurn.getPassiveBonus('cost_reduction');
            const effectiveCost = Math.max(0, this.currentAction.cost - costReduction);
            if(effectiveCost <= this.currentTurn.energy) {
                this.currentTurn.removeEnergy(effectiveCost);
            }
        }

        if(this.currentAction.energy !== undefined) {
            // Apply energy gain bonus modifier
            const energyBonus = this.currentTurn.getPassiveBonus('energy_gain_bonus');
            const bonusEnergy = Math.floor(this.currentAction.energy * (energyBonus / 100));
            this.currentTurn.addEnergy(this.currentAction.energy + bonusEnergy);
        }

        // If spell echo triggered, repeat the action
        if(shouldEcho) {
            this.isEchoAction = true;
            this.currentHit = 0;
            this.hitRepeat = 0;
            this.hitHistory = [];
            let firstHit = this.currentAction.hits[0];
            if(firstHit !== undefined) {
                this.hitTimer.start(firstHit.delay !== undefined ? firstHit.delay : this.hitInterval);
            } else {
                this.processHit();
            }
            return;
        }
        
        // Reset echo flag
        this.isEchoAction = false;

        // Blue Mage (Slayer) ability learning
        this.tryLearnAbility();

        let resolvedEffects = this.currentTurn.trigger('turn_end');

        this.nextRoundOrder.push(this.currentTurn);
        this.nextRoundOrder.sort((a,b) => {
            let agility = this.manager.stats.getObjectByID("adventuring:agility");
            return b.getEffectiveStat(agility) - a.getEffectiveStat(agility);
        });

        this.removeDead();

        if(this.party.all.every(enemy => enemy.dead)) {
            this.complete();
            return;
        }
        
        if(this.manager.party.all.every(hero => hero.dead)) {
            // Try to revive with Phoenix Feather or similar consumable
            if(this.manager.consumables.onPartyWipe()) {
                // Party was revived, continue combat
                this.nextTurn();
                return;
            }
            this.manager.dungeon.abandon();
            return;
        }

        if(this.currentRoundOrder.length === 0)
            this.nextRound();

        this.nextTurn();
    }

    complete() {
        this.all.forEach(member => {
            let resolvedEffects = member.trigger('encounter_end');
        });

        // Track monster kills for Slayer tasks and Monster Mastery
        this.party.all.forEach(enemy => {
            if(enemy.dead && enemy.monster) {
                this.manager.slayers.onMonsterKilled(enemy.monster);
                this.manager.bestiary.registerKill(enemy.monster);
            }
        });

        // Track combat achievements
        if(this.manager.achievementManager) {
            const heroes = this.manager.party.all;
            const aliveHeroes = heroes.filter(h => !h.dead);
            const flawless = heroes.every(h => !h.dead && h.hitpoints >= h.maxHitpoints);
            const lastStand = aliveHeroes.length === 1;
            
            // Record combat end stats (damage/healing tracked elsewhere)
            this.manager.achievementManager.recordCombatEnd(
                flawless,
                this.round,
                lastStand,
                0, // Total damage - would need more tracking
                0  // Total healing - would need more tracking
            );
        }

        this.reset();

        if(this.manager.dungeon.active)
            this.manager.dungeon.go();

        let floor = this.manager.dungeon.floor;

        let cell = floor.current;

        if((cell.type === floor.exit || cell.type === floor.boss) && cell.explored) {
            floor.complete();
        }
        this.manager.dungeon.updateFloorCards();
        this.manager.overview.renderQueue.status = true;
    }

    updateTurnCards() {
        this.roundCard.icon = mod.getContext(this.manager.namespace).getResourceUrl('assets/media/empty.png');
        this.roundCard.renderQueue.icon = true

        let cards = [];

        if(this.currentTurn !== undefined)
            cards.push(this.currentTurn.card);

        cards.push(...this.currentRoundOrder.map(c => c.card));
        if(cards.length > 0) {
            this.roundCard.name = `Round ${this.roundCounter + 1}`
            this.roundCard.renderQueue.name = true;
            cards.push(this.roundCard);
        }

        cards.push(...this.nextRoundOrder.map(c => c.card));
        
        this.manager.overview.cards.renderQueue.cards.clear();
        

        this.all.forEach(character => {
            character.setHighlight(character === this.currentTurn);
        });

        cards.forEach((card, i) => {
            card.setHighlight(i === 0);
            this.manager.overview.cards.renderQueue.cards.add(card)
        });
        this.manager.overview.cards.renderQueue.update = true;
    }

    // Apply passives from character's combatJob and passiveJob
    applyJobPassives(character, triggerType) {
        // Get passives from combatJob
        if(character.combatJob !== undefined) {
            this.manager.passives.allObjects.forEach(passive => {
                if(passive.canEquip(character) && passive.unlockedBy(character.combatJob)) {
                    passive.apply(character, triggerType, this);
                }
            });
        }
        // Get passives from passiveJob (if it's a combat job with passives)
        if(character.passiveJob !== undefined && character.passiveJob !== character.combatJob) {
            this.manager.passives.allObjects.forEach(passive => {
                if(passive.canEquip(character) && passive.unlockedBy(character.passiveJob)) {
                    passive.apply(character, triggerType, this);
                }
            });
        }
    }

    // Apply passives from monster's passive list
    applyMonsterPassives(enemy, triggerType) {
        if(!enemy.base || !enemy.base.passives) return;
        
        enemy.base.passives.forEach(passiveId => {
            const passive = this.manager.passives.getObjectByID(passiveId);
            if(passive) {
                passive.apply(enemy, triggerType, this);
            }
        });
    }

    // Blue Mage (Slayer) ability learning
    tryLearnAbility() {
        // Only heroes can learn abilities
        if(!(this.currentTurn instanceof AdventuringHero))
            return;
        
        // Check if the ability has a learnType property
        if(!this.currentAction.learnType)
            return;
        
        // Check if character has the Slayer job as combat job (must be active to learn)
        const slayerJob = this.manager.jobs.getObjectByID('adventuring:slayer');
        if(!slayerJob)
            return;
        
        // Only the combat job can use learning abilities
        if(this.currentTurn.combatJob !== slayerJob)
            return;
        
        // Get targets that were hit (from hitHistory)
        if(this.hitHistory.length === 0)
            return;
        
        // Find the first living enemy that was hit (preferring front)
        let targetEnemy = null;
        for(const targets of this.hitHistory) {
            for(const target of targets) {
                if(target instanceof AdventuringEnemy) {
                    targetEnemy = target;
                    break;
                }
            }
            if(targetEnemy)
                break;
        }
        
        if(!targetEnemy)
            return;
        
        // Use the Grimoire to try learning
        const learnType = this.currentAction.learnType;
        const learnBonus = this.currentAction.learnBonus || 0;
        
        // Grimoire handles the roll, logging, and notification
        const learned = this.manager.grimoire.tryLearn(
            this.currentTurn,
            targetEnemy,
            learnType,
            learnBonus
        );
        
        // Also add to old learnedAbilities Set for backward compatibility
        if(learned) {
            this.manager.learnedAbilities.add(learned.id);
        }
    }

    render() {
        this.party.render();
    }

    encode(writer) {
        writer.writeBoolean(this.isFighting);
        this.party.encode(writer);

        this.turnTimer.encode(writer);
        this.hitTimer.encode(writer);

        writer.writeUint8(this.all.indexOf(this.currentTurn));
        writer.writeBoolean(this.currentTurn !== undefined && this.currentAction === this.currentTurn.spender);
        writer.writeUint8(this.currentHit);
        writer.writeUint8(this.hitRepeat);

        writer.writeArray(this.hitHistory, (targets, writer) => {
            writer.writeArray(targets, (target, writer) => {
                writer.writeUint8(this.all.indexOf(target));
            });
        });

        writer.writeArray(this.currentRoundOrder, (character, writer) => {
            writer.writeUint8(this.all.indexOf(character));
        });
        writer.writeArray(this.nextRoundOrder, (character, writer) => {
            writer.writeUint8(this.all.indexOf(character));
        });
        return writer;
    }

    decode(reader, version) {
        this.isFighting = reader.getBoolean();
        this.party.decode(reader, version);

        this.turnTimer.decode(reader, version);
        this.hitTimer.decode(reader, version);

        this.currentTurn = this.all[reader.getUint8()];
        let isSpender = reader.getBoolean();
        if(this.currentTurn !== undefined)
            this.currentAction = isSpender ? this.currentTurn.spender : this.currentTurn.generator;
        this.currentHit = reader.getUint8();
        this.hitRepeat = reader.getUint8();

        this.hitHistory = reader.getArray((reader)=>{
            return reader.getArray((reader)=>{
                const characterIndex = reader.getUint8();
                return this.all[characterIndex];
            });
        });

        reader.getArray((reader)=>{
            const characterIndex = reader.getUint8();
            this.currentRoundOrder.push(this.all[characterIndex]);
        });
        reader.getArray((reader)=>{
            const characterIndex = reader.getUint8();
            this.nextRoundOrder.push(this.all[characterIndex]);
        });
    }

    getErrorLog() {
        let log = `Encounter:\n`;
        log += `  Is Fighting: ${this.isFighting}\n`;
        log += `  Round: ${this.roundCounter}\n`;
        log += `  Current Turn: ${this.currentTurn?.name || 'none'}\n`;
        log += `  Current Action: ${this.currentAction?.id || 'none'}\n`;
        log += `  Turn Timer Active: ${this.turnTimer.isActive}\n`;
        log += `  Hit Timer Active: ${this.hitTimer.isActive}\n`;
        log += `  Current Round Order: [${this.currentRoundOrder.map(c => c.name).join(', ')}]\n`;
        return log;
    }
}