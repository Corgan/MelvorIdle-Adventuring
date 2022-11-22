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
                this.manager.dungeon.groupGenerator.getEntry(),
                this.manager.dungeon.groupGenerator.getEntry(),
                this.manager.dungeon.groupGenerator.getEntry()
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

        this.turnTimer.start(this.turnInterval);
        this.currentTurn = this.currentRoundOrder.shift();
        
        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;
        this.updateTurns();
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
        this.updateTurns();
    }

    removeDead() {
        this.currentRoundOrder = this.currentRoundOrder.filter(character => character.hitpoints > 0);
        this.nextRoundOrder = this.nextRoundOrder.filter(character => character.hitpoints > 0);
    }

    nextRound() {
        this.currentRoundOrder = this.nextRoundOrder;
        this.nextRoundOrder = [];
        this.roundCounter++;
        this.manager.overview.renderQueue.status = true;
    }

    processTurn() {
        this.currentAction = this.currentTurn.action;
        this.currentHit = 0;
        this.hitRepeat = 0;
        this.hitHistory = [];

        let currentHit = this.currentAction.hits[this.currentHit];
        this.hitTimer.start(currentHit.delay !== undefined ? currentHit.delay : this.hitInterval);
        this.manager.overview.renderQueue.turnProgressBar = true;

        this.updateTurns();
    }

    processHit() {
        if(this.currentHit >= this.currentAction.hits.length) {
            this.endTurn();
            return;
        }
        
        let currentHit = this.currentAction.hits[this.currentHit];

        let effectType = currentHit.type;
        let targetType = currentHit.target;
        let amount = currentHit.getAmount(this.currentTurn.stats);

        let targetParty;

        if(this.currentTurn instanceof AdventuringHero) {
            if(effectType == "heal") {
                targetParty = this.manager.party;
            } else if(effectType == "damage") {
                targetParty = this.party;
            }
        } else if (this.currentTurn instanceof AdventuringEnemy) {
            if(effectType == "heal") {
                targetParty = this.party;
            } else if(effectType == "damage") {
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
            targets.forEach(t => {
                if(t !== undefined) {
                    this.manager.log.add(`${this.currentTurn.name} ${effectType}s ${t.name} with ${this.currentAction.name} for ${amount}`);
                    t.applyEffect(effectType, amount);
                }
            });
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

        this.hitTimer.start(endTurnDelay);
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    endTurn() {
        if(this.currentAction.cost !== undefined && this.currentAction.cost >= this.currentTurn.energy)
            this.currentTurn.removeEnergy(this.currentAction.cost);

        if(this.currentAction.energy !== undefined)
            this.currentTurn.addEnergy(this.currentAction.energy);
        
        this.nextRoundOrder.push(this.currentTurn);
        this.nextRoundOrder.sort((a,b) => {
            let agility = this.manager.stats.getObjectByID("adventuring:agility");
            b.stats.get(agility) - a.stats.get(agility);
        });

        this.removeDead();
        if(this.currentRoundOrder.length === 0)
            this.nextRound();
        this.currentTurn = this.currentRoundOrder.shift();

        this.updateTurns();

        if(this.party.all.every(enemy => enemy.dead)) {
            this.complete();
            return;
        }
        
        if(this.manager.party.all.every(hero => hero.dead)) {
            this.manager.dungeon.abandon();
            return;
        }

        this.turnTimer.start(this.turnInterval);
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    complete() {
        this.reset();

        let floor = this.manager.dungeon.floor;

        let [x, y, type, explored] = floor.current;

        if(type == AdventuringDungeonFloor.tiles.exit && explored) {
            floor.complete();
        } else {
            this.manager.dungeon.updateFloorCards();
            this.manager.dungeon.go();
        }
    }

    updateTurns() {
        this.roundCard.setIcon(cdnMedia('assets/media/main/question.svg'));

        let cards = [];

        if(this.currentTurn !== undefined)
            cards.push(this.currentTurn.card);

        cards.push(...this.currentRoundOrder.map(c => c.card));
        if(cards.length > 0) {
            this.roundCard.setName(`Round ${this.roundCounter + 1}`)
            cards.push(this.roundCard);
        }

        cards.push(...this.nextRoundOrder.map(c => c.card));
        //if(this.currentRoundOrder.length === 0 && this.nextRoundOrder.length > 0) {
        //    this.roundCard.setName(`Round ${this.roundCounter + 2}`)
        //    cards.push(this.roundCard);
        //}
        
        this.manager.overview.cards.renderQueue.cards.clear();
        

        this.all.forEach(character => {
            character.setHighlight(character === this.currentTurn);
        });

        cards.forEach((card, i) => {
            card.setHighlight(i == 0);
            this.manager.overview.cards.renderQueue.cards.add(card)
        });
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