const { loadModule } = mod.getContext(import.meta);

const { sortByAgility, resolveTargets, PassiveEffectProcessor, PassiveEffects } = await loadModule('src/core/adventuring-utils.mjs');
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
        
        // Passive effect processor for unified damage/heal calculations
        this.passiveEffects = new PassiveEffectProcessor(this);
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
        this.currentRoundOrder = sortByAgility([...this.all].filter(c => !c.dead), this.manager.stats);
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

        // Reset effect limits for combat start (characters and party)
        this.all.forEach(member => {
            member.resetEffectLimits('combat');
            member.resetEffectLimits('round');
            member.resetEffectLimits('turn');
        });
        this.manager.party.resetEffectLimits('combat');
        this.manager.party.resetEffectLimits('round');
        this.manager.party.resetEffectLimits('turn');

        // Job passives are now handled by hero's getAllPendingEffectsForTrigger()
        // Monster passives are now handled by enemy's getAllPendingEffectsForTrigger()
        // via the central trigger dispatcher

        // Party-scoped effects fire first via party.trigger()
        this.manager.party.trigger('encounter_start', { encounter: this });
        
        // Then character-scoped effects (includes monster passives for enemies)
        this.all.forEach(member => {
            let resolvedEffects = member.trigger('encounter_start', { encounter: this });
        });

        // Trigger tutorial for first combat
        this.manager.tutorialManager.checkTriggers('event', { event: 'combatStart' });

        // Also trigger round_start for the first round
        this.all.forEach(member => {
            let resolvedEffects = member.trigger('round_start', { encounter: this });
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
            let resolvedEffects = member.trigger('round_end', { encounter: this });
        });

        this.currentRoundOrder = this.nextRoundOrder;
        this.nextRoundOrder = [];
        this.roundCounter++;
        this.manager.overview.renderQueue.status = true;
        
        // Reset round-based effect limits (characters and party)
        this.all.forEach(member => {
            member.resetEffectLimits('round');
            member.resetEffectLimits('turn');
        });
        this.manager.party.resetEffectLimits('round');
        this.manager.party.resetEffectLimits('turn');

        // Job and monster passives are now handled by getAllPendingEffectsForTrigger()

        // Party-scoped effects fire first via party.trigger()
        this.manager.party.trigger('round_start', { encounter: this });
        
        // Then character-scoped effects (includes monster passives for enemies)
        this.all.forEach(member => {
            let resolvedEffects = member.trigger('round_start', { encounter: this });
        });
    }

    nextTurn() {
        this.currentTurn = this.currentRoundOrder.shift();
        
        // Reset turn-based effect limits for the active character
        if (this.currentTurn) {
            this.currentTurn.resetEffectLimits('turn');
        }
        
        this.turnTimer.start(this.turnInterval);
        
        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;
        this.updateTurnCards();
    }

    /**
     * Process damage effect modifiers (miss, dodge, bonus, reduction, crit)
     * Uses CombatModifierProcessor for unified modifier pipeline.
     * @param {Object} effect - The effect being applied
     * @param {Object} builtEffect - The built effect with calculated amounts
     * @param {Object} target - The target character
     * @returns {Object|null} Modified builtEffect with isCrit flag, or null if skipped
     */
    _processDamageEffect(effect, builtEffect, target) {
        const result = this.passiveEffects.processDamage(
            this.currentTurn, 
            target, 
            builtEffect.amount,
            builtEffect
        );
        
        if (result.negated === 'miss') {
            this.manager.log.add(`${this.currentTurn.name}'s attack misses ${target.name}!`);
            return null;
        }
        if (result.negated === 'dodge') {
            return null;
        }
        
        return {
            ...builtEffect,
            amount: result.amount,
            isCrit: result.isCrit
        };
    }

    /**
     * Process healing effect modifiers
     * Uses PassiveEffectProcessor for unified modifier pipeline.
     * @param {Object} effect - The effect being applied
     * @param {Object} builtEffect - The built effect with calculated amounts
     * @param {Object} target - The target character
     * @returns {Object} Modified builtEffect
     */
    _processHealEffect(effect, builtEffect, target) {
        const result = this.passiveEffects.processHealing(
            this.currentTurn,
            target,
            builtEffect.amount,
            builtEffect
        );
        
        return {
            ...builtEffect,
            amount: result.amount
        };
    }

    /**
     * Handle post-damage effects (execute, reflect, lifesteal, on_kill)
     * Uses PassiveEffectProcessor for execute and reflect calculations.
     * @param {Object} target - The target that was damaged
     * @param {number} damageDealt - Amount of damage dealt
     * @param {Object} builtEffect - The built effect
     * @param {boolean} isCrit - Whether this was a critical hit
     * @param {number} hpPercentBefore - Target's HP% before damage was applied
     */
    _afterDamageDealt(target, damageDealt, builtEffect, isCrit, hpPercentBefore = 100) {
        // Trigger crit if this was a critical hit
        if(isCrit) {
            this.currentTurn.trigger('crit', { target, damageDealt, encounter: this });
        }
        
        target.trigger('after_damage_received', { 
            attacker: this.currentTurn, 
            damageReceived: damageDealt, 
            hpPercentBefore,
            encounter: this,
            ...builtEffect 
        });
        
        // Check execute threshold
        if(this.passiveEffects.checkExecute(this.currentTurn, target)) {
            this.manager.log.add(`${this.currentTurn.name} executes ${target.name}!`);
            target.hitpoints = 0;
            target.damage({ amount: 0 }, this.currentTurn);
        }
        
        // Check reflect damage
        const reflectAmount = this.passiveEffects.calculateReflect(this.currentTurn, target, damageDealt);
        if(reflectAmount > 0) {
            this.currentTurn.damage({ amount: reflectAmount }, target);
            this.manager.log.add(`${target.name} reflects ${reflectAmount} damage to ${this.currentTurn.name}!`);
        }
        
        // Trigger lifesteal with damage dealt
        this.currentTurn.trigger('after_damage_delivered', { target, damageDealt, encounter: this, ...builtEffect });
        
        // Check if target died and trigger kill
        if(target.dead) {
            this.currentTurn.trigger('kill', { target, damageDealt, encounter: this });
        }
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
        
        // Job and monster passives are now handled by getAllPendingEffectsForTrigger()
        
        let resolvedEffects = this.currentTurn.trigger('turn_start', { skip: false, encounter: this });

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

        let effectParty = currentHit.party ?? "enemy"; // Default to enemy if not specified
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
        if(targetType === "self") {
            targets = [this.currentTurn];
        } else {
            targets = resolveTargets(targetType, targetParty);
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
                        
                        if(effect.type === "damage" || effect.type === "damage_flat") {
                            builtEffect = this._processDamageEffect(effect, builtEffect, target);
                            if(!builtEffect) return; // Skipped (miss/dodge)
                            isCrit = builtEffect.isCrit;
                        } else if(effect.type === "heal" || effect.type === "heal_flat") {
                            builtEffect = this._processHealEffect(effect, builtEffect, target);
                        }

                        // Track damage for lifesteal
                        let damageDealt = (effect.type === "damage" || effect.type === "damage_flat") ? builtEffect.amount : 0;

                        if(effect.type === "damage" || effect.type === "damage_flat" || effect.type === "heal" || effect.type === "heal_flat") {
                            const critText = isCrit ? ' (CRIT!)' : '';
                            this.manager.log.add(`${this.currentTurn.name} ${effect.type}s ${target.name} with ${this.currentAction.name} for ${builtEffect.amount}${critText}`);
                        }
                        
                        // Capture HP percent before applying damage (for hp_crossed_below conditions)
                        const hpPercentBefore = target.hitpointsPercent;
                        
                        target.applyEffect(effect, builtEffect, this.currentTurn);
                        
                        if(effect.type === "damage" || effect.type === "damage_flat") {
                            this._afterDamageDealt(target, damageDealt, builtEffect, isCrit, hpPercentBefore);
                        } else if(effect.type === "heal" || effect.type === "heal_flat") {
                            target.trigger('after_heal_received', { attacker: this.currentTurn, ...builtEffect });
                            this.currentTurn.trigger('after_heal_delivered', { target, ...builtEffect });
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
            const totalEnergy = this.passiveEffects.processEnergyGain(this.currentTurn, currentHit.energy);
            this.currentTurn.addEnergy(totalEnergy);
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
            if(this.passiveEffects.checkSpellEcho(this.currentTurn)) {
                shouldEcho = true;
                this.manager.log.add(`${this.currentTurn.name}'s spell echoes!`);
            }
        }
        
        // Apply cost reduction for spenders
        if(this.currentAction.cost !== undefined && this.currentAction.cost > 0) {
            const effectiveCost = this.passiveEffects.processCostReduction(this.currentTurn, this.currentAction.cost);
            if(effectiveCost <= this.currentTurn.energy) {
                this.currentTurn.removeEnergy(effectiveCost);
            }
        }

        if(this.currentAction.energy !== undefined) {
            // Apply energy gain bonus modifier
            const totalEnergy = this.passiveEffects.processEnergyGain(this.currentTurn, this.currentAction.energy);
            this.currentTurn.addEnergy(totalEnergy);
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
        this.nextRoundOrder = sortByAgility(this.nextRoundOrder, this.manager.stats);

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

    // Blue Mage (Slayer) ability learning
    tryLearnAbility() {
        // Only heroes can learn abilities
        if(!(this.currentTurn instanceof AdventuringHero))
            return;
        
        // Check if the ability has a learnType property
        if(!this.currentAction.learnType)
            return;
        
        // Check if character has the Slayer job as combat job (must be active to learn)
        const slayerJob = this.manager.cached.slayerJob;
        if(slayerJob === undefined)
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
        log += `  Current Turn: ${this.currentTurn !== undefined ? this.currentTurn.name : 'none'}\n`;
        log += `  Current Action: ${this.currentAction !== undefined ? this.currentAction.id : 'none'}\n`;
        log += `  Turn Timer Active: ${this.turnTimer.isActive}\n`;
        log += `  Hit Timer Active: ${this.hitTimer.isActive}\n`;
        log += `  Current Round Order: [${this.currentRoundOrder.map(c => c.name).join(', ')}]\n`;
        return log;
    }
}