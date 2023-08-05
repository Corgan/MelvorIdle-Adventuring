const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringGenerator } = await loadModule('src/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/adventuring-spender.mjs');
const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/adventuring-dungeon-floor.mjs');

const { AdventuringEnemy } = await loadModule('src/adventuring-enemy.mjs');
const { AdventuringHero } = await loadModule('src/adventuring-hero.mjs');

const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/adventuring-party.mjs');

const { AdventuringEncounterUIComponent } = await loadModule('src/components/adventuring-encounter.mjs');
const { AdventuringPartyUIComponent } = await loadModule('src/components/adventuring-party.mjs');

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

        this.component = new AdventuringEncounterUIComponent(this.manager, this.game, this);

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
            return b.stats.get(agility) - a.stats.get(agility);
        });
        this.nextRoundOrder = [];
        this.roundCounter = 1;
        this.isFighting = true;

        this.all.forEach(member => {
            let resolvedEffects = member.trigger('encounter_start');
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
        this.currentAction = this.currentTurn.action;
        this.currentHit = 0;
        this.hitRepeat = 0;
        this.hitHistory = [];
        
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
            if(effectParty == "ally") {
                targetParty = this.manager.party;
            } else if(effectParty == "enemy") {
                targetParty = this.party;
            }
        } else if (this.currentTurn instanceof AdventuringEnemy) {
            if(effectParty == "ally") {
                targetParty = this.party;
            } else if(effectParty == "enemy") {
                targetParty = this.manager.party;
            }
        }

        let targets = [];
        if(targetType == "none") {
            targets = [];
        } else if(targetType == "front") {
            if(!targetParty.back.dead)
                targets = [targetParty.back];
            if(!targetParty.center.dead)
                targets = [targetParty.center];
            if(!targetParty.front.dead)
                targets = [targetParty.front];
        } else if(targetType == "back") {
            if(!targetParty.front.dead)
                targets = [targetParty.front];
            if(!targetParty.center.dead)
                targets = [targetParty.center];
            if(!targetParty.back.dead)
                targets = [targetParty.back];
        } else if(targetType == "random") {
            let potentialTargets = targetParty.all.filter(target => !target.dead);
            targets = [potentialTargets[Math.floor(Math.random()*potentialTargets.length)]];
        } else if(targetType == "aoe") {
            targets = targetParty.all.filter(target => !target.dead);
        } else if(targetType == "lowest") {
            let potentialTargets = targetParty.all.filter(target => !target.dead).reduce((lowest, target) => {
                if(lowest === undefined || lowest.hitpointsPercent > target.hitpointsPercent)
                    lowest = target;
                return lowest;
            });
            targets = [potentialTargets];
        } else if(targetType == "self") {
            targets = [this.currentTurn];
        }

        if(targets.length > 0) {
            this.currentTurn.trigger('before_ability_cast', { targets: targets });

            targets.forEach(target => {
                if(target !== undefined) {
                    this.currentTurn.trigger('before_hit_delivered', { target: target });
                    target.trigger('before_hit_received', { attacker: this.currentTurn });

                    currentHit.effects.forEach(effect => {
                        let builtEffect = {
                            amount: effect.getAmount(this.currentTurn.stats)
                        };
                        
                        if(effect.stacks !== undefined)
                            builtEffect.stacks = effect.getStacks(this.currentTurn.stats);

                        if(effect.type === "damage" || effect.type === "heal") {
                            if(effect.type === "damage") {
                                builtEffect = this.currentTurn.trigger('before_damage_delivered', { target: target, ...builtEffect });
                                builtEffect = target.trigger('before_damage_received', { attacker: this.currentTurn, ...builtEffect });
                            } else if (effect.type === "heal") {
                                builtEffect = this.currentTurn.trigger('before_heal_delivered', { target: target, ...builtEffect });
                                builtEffect = target.trigger('before_heal_received', { attacker: this.currentTurn, ...builtEffect });
                            }
                        }

                        if(effect.type === "damage" || effect.type === "heal")
                            this.manager.log.add(`${this.currentTurn.name} ${effect.type}s ${target.name} with ${this.currentAction.name} for ${builtEffect.amount}`);
                        
                        target.applyEffect(effect, builtEffect, this.currentTurn);
                        
                        if(effect.type === "damage" || effect.type === "heal") {
                            if(effect.type === "damage") {
                                builtEffect = target.trigger('after_damage_received', { attacker: this.currentTurn, ...builtEffect });
                                builtEffect = this.currentTurn.trigger('after_damage_delivered', { target: target, ...builtEffect });
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

        if(currentHit.energy !== undefined)
            this.currentTurn.addEnergy(currentHit.energy);

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
        if(this.currentAction.cost !== undefined && this.currentAction.cost >= this.currentTurn.energy)
            this.currentTurn.removeEnergy(this.currentAction.cost);

        if(this.currentAction.energy !== undefined)
            this.currentTurn.addEnergy(this.currentAction.energy);

        let resolvedEffects = this.currentTurn.trigger('turn_end');

        this.nextRoundOrder.push(this.currentTurn);
        this.nextRoundOrder.sort((a,b) => {
            let agility = this.manager.stats.getObjectByID("adventuring:agility");
            b.stats.get(agility) - a.stats.get(agility);
        });

        this.removeDead();

        if(this.party.all.every(enemy => enemy.dead)) {
            this.complete();
            return;
        }
        
        if(this.manager.party.all.every(hero => hero.dead)) {
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
            card.setHighlight(i == 0);
            this.manager.overview.cards.renderQueue.cards.add(card)
        });
        this.manager.overview.cards.renderQueue.update = true;
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
}