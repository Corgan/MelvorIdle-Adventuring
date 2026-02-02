const { loadModule } = mod.getContext(import.meta);

const { sortByAgility, resolveTargets, PassiveEffectProcessor, awardCombatXP } = await loadModule('src/core/utils/adventuring-utils.mjs');
const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { EffectCache } = await loadModule('src/core/effects/effect-cache.mjs');

const { AdventuringGenerator } = await loadModule('src/dungeon/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/town/adventuring-spender.mjs');
const { AdventuringCard } = await loadModule('src/ui/adventuring-card.mjs');
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

        // Shared effect cache for all enemies (parallel to Party's effectCache)
        this.effectCache = new EffectCache();

        this.party = new AdventuringEnemyParty(this.manager, this.game);
        this.party.component.mount(this.component.enemies);

        this.roundCard = new AdventuringCard(this.manager, this.game);

        this.turnTimer = new Timer('Turn', () => this.processTurn());
        this.hitTimer = new Timer('Hit', () => this.processHit());

        this.passiveEffects = new PassiveEffectProcessor(this);
    }

    get turnInterval() { return this.manager.config.timers.turn; }
    get hitInterval() { return this.manager.config.timers.hit; }
    get endTurnInterval() { return this.manager.config.timers.endTurn; }

    initEffectCache() {
        // Dungeon environment effects (difficulty, endless scaling)
        this.effectCache.registerSource('environment', () => 
            this.manager.dungeon?.getEffects({ party: 'enemy' }) || []
        );

        // Effects from heroes that target enemies (party: 'enemy')
        this.effectCache.registerSource('heroes', () => {
            const effects = [];
            if (!this.manager?.party) return effects;
            
            for (const hero of this.manager.party.all) {
                const heroEffects = hero.effectCache?.getEffects({ party: 'enemy' }) || [];
                for (const effect of heroEffects) {
                    effects.push(effect);
                }
            }
            return effects;
        });

        // Consumable effects targeting enemies
        this.effectCache.registerSource('consumables', {
            getEffects: (f) => this.manager.consumables?.getEffects(f) || [],
            filters: { party: 'enemy' },
            onTrigger: (effect, context, host) => {
                const { source, sourceName, sourceTier } = effect;
                this.manager.consumables.removeCharges(source, sourceTier, 1);
                this.manager.log.add(`${sourceName} consumed a charge.`, {
                    category: 'system'
                });
            }
        });

        // Tavern effects targeting enemies
        this.effectCache.registerSource('tavern', {
            getEffects: (f) => this.manager.tavern?.getEffects(f) || [],
            filters: { party: 'enemy' }
        });
    }

    getEffects(filters = null) {
        return this.effectCache.getEffects(filters);
    }

    getPassiveBonus(effectType) {
        return this.effectCache.getBonus(effectType);
    }

    getStatBonus(statId) {
        return this.effectCache.getStatBonus(statId);
    }

    invalidateEffects(sourceId) {
        this.effectCache.invalidate(sourceId);
        // Also invalidate enemy stats UI and breakdown cache
        this.party.forEach(enemy => {
            if (enemy.stats) {
                enemy.stats.renderQueue.stats = true;
            }
            if (enemy.statBreakdownCache) {
                enemy.statBreakdownCache.invalidate();
            }
            // Invalidate the enemy's encounter source
            if (enemy.effectCache) {
                enemy.effectCache.invalidate('encounter');
            }
        });
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

    onLoad() {
        super.onLoad();
        this.initEffectCache();
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

    startEncounter(tileType = 'encounter') {
        // Initialize encounter stats tracking
        this.manager.combatTracker.startEncounter(tileType);

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

        // Fire encounter_start with all context (stats + tutorial both listen)
        const monsters = this.party.all.map(e => e.base).filter(Boolean);
        this.manager.conductor.trigger('encounter_start', { encounter: this, monsters });

        this.manager.conductor.trigger('round_start', { encounter: this });

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
        this.manager.conductor.trigger('round_end', { encounter: this });

        this.currentRoundOrder = this.nextRoundOrder;
        this.nextRoundOrder = [];
        this.roundCounter++;
        this.manager.overview.renderQueue.status = true;

        this.all.forEach(member => {
            member.resetEffectLimits('round', 'turn');
        });
        this.manager.party.resetEffectLimits('round', 'turn');

        this.manager.conductor.trigger('round_start', { encounter: this });
    }

    nextTurn() {
        this.currentTurn = this.currentRoundOrder.shift();

        if (this.currentTurn) {
            this.currentTurn.resetEffectLimits('turn');
        }

        this.turnTimer.start(this.manager.scaleInterval(this.turnInterval));

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
            this.manager.log.add(`${this.currentTurn.getDisplayName()}'s attack misses ${target.getDisplayName()}!`, {
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
            damageBlocked: builtEffect.damageBlocked || 0,
            hpPercentBefore,
            encounter: this,
            ...builtEffect
        });

        if(this.passiveEffects.checkExecute(this.currentTurn, target)) {
            this.manager.log.add(`${this.currentTurn.getDisplayName()} executes ${target.getDisplayName()}!`, {
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
            this.manager.log.add(`${target.getDisplayName()} reflects ${reflectAmount} damage to ${this.currentTurn.getDisplayName()}!`, {
                category: 'combat_damage',
                source: target,
                target: this.currentTurn
            });
        }

        this.currentTurn.trigger('after_damage_delivered', { target, damageDealt, ability: this.currentAction, encounter: this, ...builtEffect });

        if(target.dead) {
            this.currentTurn.trigger('kill', { target, damageDealt, encounter: this });
        }

        if(builtEffect.damageContributions && builtEffect.damageContributions.length > 0) {
            // Calculate HP before this damage was applied for overkill prevention
            const hpBefore = Math.floor(target.maxHitpoints * hpPercentBefore / 100);
            this._processDamageContributions(builtEffect.damageContributions, damageDealt, hpBefore);
        }
    }
    
    _processDamageContributions(contributions, totalDamage, targetHpBefore) {
        // Scale contributions proportionally if there was overkill
        const effectiveDamage = Math.min(totalDamage, targetHpBefore);
        const scale = totalDamage > 0 ? effectiveDamage / totalDamage : 0;
        
        for(const contribution of contributions) {
            if(!contribution.source || !contribution.source.isHero) continue;
            if(contribution.amount <= 0) continue;
            // Scale contribution to remove overkill XP
            const scaledAmount = Math.floor(contribution.amount * scale);
            if(scaledAmount > 0) {
                awardCombatXP(contribution.source, Math.floor(scaledAmount / 2), this.manager);
            }
        }
    }

    processTurn() {

        if(this.manager.timersPaused) {
            this.turnTimer.start(this.manager.scaleInterval(this.turnInterval));
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
            this.hitTimer.start(this.manager.scaleInterval(currentHit.delay !== undefined ? currentHit.delay : this.hitInterval));
            this.manager.overview.renderQueue.turnProgressBar = true;
            this.updateTurnCards();
        } else {
            this.processHit();
        }
    }

    /**
     * Resolve targets for the current hit, applying targeting modifiers
     * @param {Object} currentHit - The hit data
     * @returns {Array} The resolved targets
     */
    _resolveHitTargets(currentHit) {
        const effectParty = (currentHit.party !== undefined) ? currentHit.party : "enemy";
        const targetType = currentHit.target;
        const targetParty = this.currentTurn.getParty(effectParty);

        const resolveContext = {
            party: targetParty,
            self: this.currentTurn,
            exclude: null
        };
        let targets = resolveTargets(targetType, resolveContext);

        // Apply targeting modifiers (taunt/confuse)
        if(effectParty === "enemy" && targets.length > 0) {
            const targetingMods = this.currentTurn.trigger('targeting', {});
            
            if(targetingMods.forcedTarget && !targetingMods.forcedTarget.dead) {
                targets = [targetingMods.forcedTarget];
                this.manager.log.add(`${this.currentTurn.getDisplayName()} is forced to attack ${targetingMods.forcedTarget.getDisplayName()}!`, {
                    category: 'combat_mechanics',
                    source: this.currentTurn,
                    target: targetingMods.forcedTarget
                });
            } else if(targetingMods.hitAlly) {
                const allyParty = this.currentTurn.getParty('ally');
                const potentialAllies = allyParty.all.filter(ally => !ally.dead && ally !== this.currentTurn);
                if(potentialAllies.length > 0) {
                    targets = [potentialAllies[Math.floor(Math.random() * potentialAllies.length)]];
                }
            }
        }

        return targets;
    }

    /**
     * Apply a single effect to a target
     * @param {Object} effect - The effect definition
     * @param {Object} target - The target character
     */
    _applyEffectToTarget(effect, target) {
        let builtEffect = {
            amount: effect.getAmount(this.currentTurn)
        };

        if(effect.stacks !== undefined) {
            builtEffect.stacks = effect.getStacks(this.currentTurn);
        }

        let isCrit = false;

        if(effect.type === "damage" || effect.type === "damage_flat") {
            builtEffect = this._processDamageEffect(effect, builtEffect, target);
            if(!builtEffect) return; // Skipped (miss/dodge)
            isCrit = builtEffect.isCrit;
        } else if(effect.type === "damage_percent_current") {
            // Deals % of target's CURRENT HP, floored to leave at least 1 HP
            const percent = builtEffect.amount;
            const currentHP = target.hitpoints;
            const rawDamage = Math.floor(currentHP * (percent / 100));
            // Deal 0 damage if target is at 1 HP, otherwise cap to leave 1 HP
            builtEffect.amount = currentHP > 1 ? Math.min(rawDamage, currentHP - 1) : 0;
        } else if(effect.type === "heal" || effect.type === "heal_flat") {
            builtEffect = this._processHealEffect(effect, builtEffect, target);
        }

        const damageDealt = (effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current") ? builtEffect.amount : 0;

        // Log damage/heal
        if(effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current" || effect.type === "heal" || effect.type === "heal_flat") {
            const critText = isCrit ? ' (CRIT!)' : '';
            const effectVerb = (effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current") ? 'damages' : 'heals';
            const category = (effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current") ? 'combat_damage' : 'combat_heal';
            this.manager.log.add(`${this.currentTurn.getDisplayName()} ${effectVerb} ${target.getDisplayName()} with ${this.currentAction.name} for ${builtEffect.amount}${critText}`, {
                category,
                source: this.currentTurn,
                target: target
            });
        }

        const hpPercentBefore = target.hitpointsPercent;
        target.applyEffect(effect, builtEffect, this.currentTurn);

        // Post-effect triggers
        if(effect.type === "damage" || effect.type === "damage_flat" || effect.type === "damage_percent_current") {
            this._afterDamageDealt(target, damageDealt, builtEffect, isCrit, hpPercentBefore);
        } else if(effect.type === "heal" || effect.type === "heal_flat") {
            // Award XP to healer based on effective healing (no overheal)
            const effectiveHeal = Math.min(builtEffect.amount, target.maxHitpoints - Math.floor(target.maxHitpoints * hpPercentBefore / 100));
            if (effectiveHeal > 0 && this.currentTurn.isHero) {
                awardCombatXP(this.currentTurn, Math.floor(effectiveHeal / 2), this.manager);
            }
            target.trigger('after_heal_received', { healer: this.currentTurn, amount: builtEffect.amount, ability: this.currentAction, ...builtEffect });
            this.currentTurn.trigger('after_heal_delivered', { target, amount: builtEffect.amount, ability: this.currentAction, ...builtEffect });
        }
    }

    /**
     * Process all effects for a hit against resolved targets
     * @param {Object} currentHit - The hit data
     * @param {Array} targets - The resolved targets
     */
    _processHitEffects(currentHit, targets) {
        if(targets.length === 0) return;

        this.currentTurn.trigger('before_ability_cast', { targets: targets });

        targets.forEach(target => {
            if(target === undefined) return;

            this.currentTurn.trigger('before_hit_delivered', { target: target });
            target.trigger('before_hit_received', { attacker: this.currentTurn });

            currentHit.effects.forEach(effect => {
                this._applyEffectToTarget(effect, target);
            });

            target.trigger('after_hit_received', { attacker: this.currentTurn });
            this.currentTurn.trigger('after_hit_delivered', { targets: targets });
        });

        this.currentTurn.trigger('after_ability_cast', { targets: targets });
        this.hitHistory.push(targets);
    }

    /**
     * Schedule the next hit or end the turn
     */
    _scheduleNextHit() {
        if(this.currentAction.hits[this.currentHit].repeat === undefined || 
           ++this.hitRepeat >= this.currentAction.hits[this.currentHit].repeat) {
            this.currentHit++;
        }

        let endTurnDelay = this.endTurnInterval;
        const nextHit = this.currentAction.hits[this.currentHit];
        if(nextHit !== undefined && nextHit.delay !== undefined) {
            endTurnDelay = nextHit.delay;
        }

        if(endTurnDelay === 0) {
            this.processHit();
        } else {
            this.hitTimer.start(this.manager.scaleInterval(endTurnDelay));
        }
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    processHit() {
        if(this.currentHit >= this.currentAction.hits.length) {
            this.endTurn();
            return;
        }

        const currentHit = this.currentAction.hits[this.currentHit];
        const targets = this._resolveHitTargets(currentHit);
        
        this._processHitEffects(currentHit, targets);

        // Process energy gain
        if(currentHit.energy !== undefined) {
            const totalEnergy = this.passiveEffects.processEnergyGain(this.currentTurn, currentHit.energy);
            this.currentTurn.addEnergy(totalEnergy);
        }

        this._scheduleNextHit();
    }

    endTurn() {

        const isSpender = this.currentAction.cost !== undefined && this.currentAction.cost > 0;
        let shouldEcho = false;

        if(isSpender && !this.isEchoAction) {
            if(this.passiveEffects.checkSpellEcho(this.currentTurn)) {
                shouldEcho = true;
                this.manager.log.add(`${this.currentTurn.getDisplayName()}'s spell echoes!`, {
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

        // Note: CombatTracker now listens to generator/spender triggers for ability tracking

        if(shouldEcho) {
            this.isEchoAction = true;
            this.currentHit = 0;
            this.hitRepeat = 0;
            this.hitHistory = [];
            let firstHit = this.currentAction.hits[0];
            if(firstHit !== undefined) {
                this.hitTimer.start(this.manager.scaleInterval(firstHit.delay !== undefined ? firstHit.delay : this.hitInterval));
            } else {
                this.processHit();
            }
            return;
        }

        this.isEchoAction = false;

        this.tryLearnAbility();

        this.currentTurn.trigger('turn_end');
        this.manager.conductor.trigger('turn_end', { character: this.currentTurn, encounter: this });

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
            this.manager.dungeon.abandon({ died: true });
            return;
        }

        if(this.currentRoundOrder.length === 0)
            this.nextRound();

        this.nextTurn();
    }

    complete() {
        this.manager.conductor.trigger('encounter_end', { encounter: this });

        // Finalize encounter stats and aggregate into run stats
        this.manager.combatTracker.endEncounter();

        this.party.all.forEach(enemy => {
            if(enemy.dead && enemy.base) {
                // Fire monster_killed trigger (bestiary, slayers, achievements all listen)
                this.manager.conductor.trigger('monster_killed', { monster: enemy.base });

                // Fire boss_killed trigger if this was a boss
                if(enemy.isBoss) {
                    const encounterStats = this.manager.combatTracker.encounter;
                    this.manager.conductor.trigger('boss_killed', {
                        boss: enemy.base,
                        bossName: enemy.base.name,
                        area: this.manager.dungeon.area,
                        difficulty: this.manager.dungeon.difficulty,
                        encounterStats: encounterStats,
                        turnsElapsed: encounterStats.turnsElapsed,
                        highestSingleHit: encounterStats.highestSingleHit,
                        damageDealt: encounterStats.damageDealt
                    });
                }
            }
        });

        const heroes = this.manager.party.combatParty;
        const aliveHeroes = heroes.filter(h => !h.dead);
        const noneJob = this.manager.cached?.noneJob;
        const activeHeroes = heroes.filter(h => h.combatJob && h.combatJob !== noneJob);
        const isSolo = activeHeroes.length === 1;
        
        // Fire encounter_end with combat stats
        this.manager.conductor.trigger('encounter_end', {
            rounds: this.round,
            heroes,
            aliveHeroes,
            isSolo,
            victory: true
        });

        this.reset();

        // Check if all heroes died (e.g., from DoT after killing last enemy)
        if(this.manager.party.combatParty.every(hero => hero.dead)) {
            this.manager.dungeon.abandon({ died: true });
            return;
        }

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