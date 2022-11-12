const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringGenerator } = await loadModule('src/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/adventuring-spender.mjs');
const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');

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
        this.currentRound = [];
        this.nextRound = [];
        this.roundCounter = 0;

        this.component = new AdventuringEncounterUIComponent(this.manager, this.game);

        this.party = new AdventuringEnemyParty(this.manager, this.game);
        this.party.component.mount(this.component.enemies);

        this.roundCard = new AdventuringCard(this.manager, this.game);
    }

    get all() {
        return [...this.manager.party.all, ...this.party.all];
    }

    onLoad() {
        super.onLoad();
        this.party.onLoad();
    }

    startEncounter(boss=false) {
        this.generateEncounter(boss);
        this.currentRound = [...this.all].filter(c => !c.dead).sort((a,b) => b.levels.Agility - a.levels.Agility);
        this.nextRound = [];
        this.roundCounter = 1;
        this.isFighting = true;
        
        this.manager.overview.renderQueue.status = true;
        this.updateTurns();
        this.manager.encounter.go();
    }

    reset() {
        this.currentRound = [];
        this.nextRound = [];
        this.roundCounter = 0;
        this.isFighting = false;
        this.updateTurns();
    }

    generateEncounter(boss=false) {
        let group;
        if(!boss) {
            let groups = this.manager.dungeon.area.groups;
            group = groups[Math.min(this.manager.dungeon.progress, this.manager.dungeon.area.groups.length)];
        } else {
            group = this.manager.dungeon.area.boss;
        }

        this.party.front.setMonster(group[0]);
        this.party.center.setMonster(group[1]);
        this.party.back.setMonster(group[2]);
    }

    nextTurn() {
        let currentTurn = this.currentRound.shift();

        let effectType = currentTurn.action.type;
        let amount = currentTurn.action.getAmount(currentTurn.levels);
        let targetType = currentTurn.action.target;

        let targetParty;

        if(currentTurn instanceof AdventuringHero) {
            if(effectType == "heal") {
                targetParty = this.manager.party;
            } else if(effectType == "damage") {
                targetParty = this.party;
            }
        } else if (currentTurn instanceof AdventuringEnemy) {
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
            let potentialTargets = targetParty.all.reduce((lowest, target) => {
                if(lowest === undefined || lowest.hitpointsPercent > target.hitpointsPercent)
                    lowest = target;
                return lowest;
            });
            targets = [potentialTargets];
        } else if(targetType == "self") {
            targets = [currentTurn];
        }

        if(targets.length > 0) {
            targets.forEach(t => t.applyEffect(effectType, amount));

            if(currentTurn.action instanceof AdventuringGenerator && currentTurn.action.energy !== undefined) {
                currentTurn.addEnergy(currentTurn.action.energy);
            } else if(currentTurn.action instanceof AdventuringSpender) {
                currentTurn.setEnergy(0);
            }
        }

        this.nextRound.push(currentTurn);
        this.nextRound.sort((a,b) => b.levels.Agility - a.levels.Agility);

        this.currentRound = this.currentRound.filter(character => character.hitpoints > 0);
        this.nextRound = this.nextRound.filter(character => character.hitpoints > 0);

        if(this.party.all.every(enemy => enemy.dead)) {
            this.manager.dungeon.completeEncounter();
            return;
        }
        
        if(this.manager.party.all.every(hero => hero.dead)) {
            this.manager.dungeon.abandon();
            return;
        }

        if(this.currentRound.length == 0) {
            this.currentRound = this.nextRound;
            this.nextRound = [];
            this.roundCounter++;
            this.manager.overview.renderQueue.status = true;
        }

        this.updateTurns();
    }

    updateTurns() {
        this.roundCard.setIcon(cdnMedia('assets/media/main/question.svg'));

        let cards = [];
        cards.push(...this.currentRound.map(c => c.card));
        if(this.currentRound.length > 0) {
            this.roundCard.setName(`Round ${this.roundCounter + 1}`)
            cards.push(this.roundCard);
        }

        cards.push(...this.nextRound.map(c => c.card));
        if(this.currentRound.length === 0 && this.nextRound.length > 0) {
            this.roundCard.setName(`Round ${this.roundCounter + 2}`)
            cards.push(this.roundCard);
        }
        
        this.manager.overview.cards.renderQueue.cards.clear();
        

        this.all.forEach(character => {
            character.setHighlight(character == this.currentRound[0]);
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

        writer.writeArray(this.currentRound, (character, writer) => {
            writer.writeUint8(this.all.indexOf(character));
        });
        writer.writeArray(this.nextRound, (character, writer) => {
            writer.writeUint8(this.all.indexOf(character));
        });
        return writer;
    }

    decode(reader, version) {
        this.isFighting = reader.getBoolean();
        this.party.decode(reader, version);
        reader.getArray((reader)=>{
            const characterIndex = reader.getUint8();
            this.currentRound.push(this.all[characterIndex]);
        });
        reader.getArray((reader)=>{
            const characterIndex = reader.getUint8();
            this.nextRound.push(this.all[characterIndex]);
        });
    }
}