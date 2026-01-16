const { loadModule } = mod.getContext(import.meta);

const { sortByAgility, resolveTargets, PassiveEffectProcessor, awardCombatXP } = await loadModule('src/core/adventuring-utils.mjs');
const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringGenerator } = await loadModule('src/dungeon/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/town/adventuring-spender.mjs');
const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/dungeon/adventuring-dungeon-floor.mjs');

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

        this.passiveEffects = new PassiveEffectProcessor(this);
    }

    /** Get all combatants - only heroes with combat jobs + all enemies */
    get all() {
        return [...this.manager.party.combatParty, ...this.party.all];
    }

    /** Get all living combatants */
    get allAlive() {
        return this.all.filter(c => !c.dead);
    }

    /** Get heroes currently in combat */
    get heroes() {
        return this.manager.party.combatParty;
    }

    /** Get living heroes in combat */
    get heroesAlive() {
        return this.manager.party.combatAlive;
    }

    get currentTimer() {
        if(this.hitTimer.isActive)
            return this.hitTimer;
        return this.turnTimer;
    }

    /**
     * Trigger an event on the hero party, enemy party, and all individual combatants.
     * @param {string} triggerName - The trigger name
     * @param {Object} context - Context to pass to handlers
     */
    _triggerAll(triggerName, context = {}) {
        this.manager.party.trigger(triggerName, context);
        this.party.trigger(triggerName, context);
        this.all.forEach(member => member.trigger(triggerName, context));
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
        // Initialize encounter stats tracking
        this.manager.combatTracker.startEncounter();

        this.currentRoundOrder = sortByAgility([...this.all].filter(c => !c.dead), this.manager.stats);
        this.nextRoundOrder = [];
        this.roundCounter = 1;
        this.isFighting = true;

        const bonusEnergy = this.manager.party.getBonusEnergy();
        if(bonusEnergy > 0) {
            this.heroesAlive.forEach(member => {
                if(member.maxEnergy > 0) {
                    member.addEnergy(bonusEnergy);
                }
            });
        }

        this.all.forEach(member => {
            member.resetEffectLimits('combat', 'round', 'turn');
        });
        this.manager.party.resetEffectLimits('combat', 'round', 'turn');

        this._triggerAll('encounter_start', { encounter: this });

        this.manager.tutorialManager.checkTriggers('event', { event: 'combatStart' });

        this._triggerAll('round_start', { encounter: this });

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
        this._triggerAll('round_end', { encounter: this });

        // Tick town heroes (those with combatJob = none) during combat
        this.manager.town.tickTownHeroes();

        this.currentRoundOrder = this.nextRoundOrder;
        this.nextRoundOrder = [];
        this.roundCounter++;
        this.manager.overview.renderQueue.status = true;

        this.all.forEach(member => {
            member.resetEffectLimits('round', 'turn');
        });
        this.manager.party.resetEffectLimits('round', 'turn');

        this._triggerAll('round_start', { encounter: this });
    }

    nextTurn() {
        this.currentTurn = this.currentRoundOrder.shift();

        if (this.currentTurn) {
            this.currentTurn.resetEffectLimits('turn');
        }

        this.turnTimer.start(this.turnInterval);

        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;
        this.updateTurnCards();
    }

    _processDamageEffect(effect, builtEffect, target) {
        const result = this.passiveEffects.processDamage(
            this.currentTurn,
            target,
            builtEffect.amount,
            builtEffect
        );

        if (result.negated === 'miss') {
            this.manager.log.add(`${this.currentTurn.name}'s attack misses ${target.name}!`, {
                category: 'combat_miss',
                source: this.currentTurn,
                target: target
            });
            return null;
        }
        if (result.negated === 'dodge') {
            return null;
        }

        return {
            ...builtEffect,
            amount: result.amount,
            isCrit: result.isCrit,
            damageContributions: result.damageContributions
        };
    }

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

    _afterDamageDealt(target, damageDealt, builtEffect, isCrit, hpPercentBefore = 100) {

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

        if(this.passiveEffects.checkExecute(this.currentTurn, target)) {
            this.manager.log.add(`${this.currentTurn.name} executes ${target.name}!`, {
                category: 'combat_death',
                source: this.currentTurn,
                target: target
            });
            target.hitpoints = 0;
            target.damage({ amount: 0 }, this.currentTurn);
        }

        const reflectAmount = this.passiveEffects.calculateReflect(this.currentTurn, target, damageDealt);
        if(reflectAmount > 0) {
            this.currentTurn.damage({ amount: reflectAmount }, target);
            this.manager.log.add(`${target.name} reflects ${reflectAmount} damage to ${this.currentTurn.name}!`, {
                category: 'combat_damage',
                source: target,
                target: this.currentTurn
            });
        }

        this.currentTurn.trigger('after_damage_delivered', { target, damageDealt, encounter: this, ...builtEffect });

        if(target.dead) {
            this.currentTurn.trigger('kill', { target, damageDealt, encounter: this });
        }

        if(builtEffect.damageContributions && builtEffect.damageContributions.length > 0) {
            this._processDamageContributions(builtEffect.damageContributions);
        }
    }
    
    _processDamageContributions(contributions) {
        for(const contribution of contributions) {
            if(!contribution.source || !contribution.source.isHero) continue;
            if(contribution.amount <= 0) continue;
            awardCombatXP(contribution.source, Math.floor(contribution.amount / 2), this.manager);
        }
    }

    processTurn() {

        if(this.manager.timersPaused) {
            this.turnTimer.start(this.turnInterval);
            return;
        }

        this.currentAction = this.currentTurn.action;
        this.currentHit = 0;
        this.hitRepeat = 0;
        this.hitHistory = [];

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

        let effectParty = (currentHit.party !== undefined) ? currentHit.party : "enemy"; // Default to enemy if not specified
        let targetType = currentHit.target;

        let targetParty;

        // Use polymorphic getParty() instead of instanceof checks
        targetParty = this.currentTurn.getParty(effectParty);

        const resolveContext = {
            party: targetParty,
            self: this.currentTurn,
            exclude: null
        };
        let targets = resolveTargets(targetType, resolveContext);

        // Apply targeting modifiers (taunt/confuse) with single trigger call
        if(effectParty === "enemy" && targets.length > 0) {
            let targetingMods = this.currentTurn.trigger('targeting', {});
            
            if(targetingMods.forcedTarget && !targetingMods.forcedTarget.dead) {
                targets = [targetingMods.forcedTarget];
                this.manager.log.add(`${this.currentTurn.name} is forced to attack ${targetingMods.forcedTarget.name}!`, {
                    category: 'combat_mechanics',
                    source: this.currentTurn,
                    target: targetingMods.forcedTarget
                });
            } else if(targetingMods.hitAlly) {
                let allyParty = this.currentTurn.getParty('ally');
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

                        let damageDealt = (effect.type === "damage" || effect.type === "damage_flat") ? builtEffect.amount : 0;

                        if(effect.type === "damage" || effect.type === "damage_flat" || effect.type === "heal" || effect.type === "heal_flat") {
                            const critText = isCrit ? ' (CRIT!)' : '';
                            const effectVerb = (effect.type === "damage" || effect.type === "damage_flat") ? 'damages' : 'heals';
                            const category = (effect.type === "damage" || effect.type === "damage_flat") ? 'combat_damage' : 'combat_heal';
                            this.manager.log.add(`${this.currentTurn.name} ${effectVerb} ${target.name} with ${this.currentAction.name} for ${builtEffect.amount}${critText}`, {
                                category,
                                source: this.currentTurn,
                                target: target
                            });
                        }

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

        const isSpender = this.currentAction.cost !== undefined && this.currentAction.cost > 0;
        let shouldEcho = false;

        if(isSpender && !this.isEchoAction) {
            if(this.passiveEffects.checkSpellEcho(this.currentTurn)) {
                shouldEcho = true;
                this.manager.log.add(`${this.currentTurn.name}'s spell echoes!`, {
                    category: 'combat_mechanics',
                    source: this.currentTurn
                });
            }
        }

        if(this.currentAction.cost !== undefined && this.currentAction.cost > 0) {
            const effectiveCost = this.passiveEffects.processCostReduction(this.currentTurn, this.currentAction.cost);
            if(effectiveCost <= this.currentTurn.energy) {
                this.currentTurn.removeEnergy(effectiveCost);
            }
        }

        if(this.currentAction.energy !== undefined) {

            const totalEnergy = this.passiveEffects.processEnergyGain(this.currentTurn, this.currentAction.energy);
            this.currentTurn.addEnergy(totalEnergy);
        }

        if(isSpender) {
            this.currentTurn.trigger('spender', { ability: this.currentAction, encounter: this });
        } else {
            this.currentTurn.trigger('generator', { ability: this.currentAction, encounter: this });
        }

        // Track ability usage and turn in CombatTracker (only for heroes)
        if(this.manager.combatTracker && this.currentTurn.isHero) {
            this.manager.combatTracker.encounter.recordAbilityUsed(this.currentAction);
            this.manager.combatTracker.encounter.recordTurn();
        }

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

        this.isEchoAction = false;

        this.tryLearnAbility();

        this.currentTurn.trigger('turn_end');

        this.nextRoundOrder.push(this.currentTurn);
        this.nextRoundOrder = sortByAgility(this.nextRoundOrder, this.manager.stats);

        this.removeDead();

        if(this.party.all.every(enemy => enemy.dead)) {
            this.complete();
            return;
        }

        if(this.manager.party.combatParty.every(hero => hero.dead)) {

            this.manager.party.trigger('party_wipe', { encounter: this });

            if(this.manager.party.combatParty.some(hero => !hero.dead)) {

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
        this._triggerAll('encounter_end');

        // Finalize encounter stats and aggregate into run stats
        this.manager.combatTracker.endEncounter();

        this.party.all.forEach(enemy => {
            if(enemy.dead && enemy.base) {
                this.manager.bestiary.registerKill(enemy.base);
                this.manager.slayers.onMonsterKilled(enemy.base);

                // Fire boss_killed trigger if this was a boss
                if(enemy.isBoss) {
                    const encounterStats = this.manager.combatTracker.encounter;
                    this.manager.achievementManager.trigger('boss_killed', {
                        boss: enemy.base,
                        bossName: enemy.base.name,
                        area: this.manager.dungeon.area,
                        difficulty: this.manager.dungeon.difficulty,
                        encounterStats: encounterStats,
                        wasFlawless: encounterStats.wasFlawless,
                        turnsElapsed: encounterStats.turnsElapsed,
                        highestSingleHit: encounterStats.highestSingleHit,
                        damageDealt: encounterStats.damageDealt
                    });
                }
            }
        });

        const heroes = this.manager.party.combatParty;
        const aliveHeroes = heroes.filter(h => !h.dead);
        const flawless = heroes.every(h => !h.dead && h.hitpoints >= h.maxHitpoints);
        const lastStand = aliveHeroes.length === 1;

        this.manager.achievementManager.recordCombatEnd({
            flawless,
            rounds: this.round,
            lastStand,
            heroes,
            aliveHeroes
        });

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

    tryLearnAbility() {

        if(!this.currentTurn.isHero)
            return;

        if(!this.currentAction.learnType)
            return;

        const slayerJob = this.manager.cached.slayerJob;
        if(slayerJob === undefined)
            return;

        if(this.currentTurn.combatJob !== slayerJob)
            return;

        if(this.hitHistory.length === 0)
            return;

        let targetEnemy = null;
        for(const targets of this.hitHistory) {
            for(const target of targets) {
                if(!target.isHero) {
                    targetEnemy = target;
                    break;
                }
            }
            if(targetEnemy)
                break;
        }

        if(!targetEnemy)
            return;

        const learnType = this.currentAction.learnType;
        const learnBonus = this.currentAction.learnBonus || 0;

        const learned = this.manager.grimoire.tryLearn(
            this.currentTurn,
            targetEnemy,
            learnType,
            learnBonus
        );

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