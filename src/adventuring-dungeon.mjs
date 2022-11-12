const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/adventuring-dungeon-floor.mjs');

const { AdventuringDungeonUIComponent } = await loadModule('src/components/adventuring-dungeon.mjs');

export class AdventuringDungeon extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.progress = 0;

        this.component = new AdventuringDungeonUIComponent(this.manager, this.game);

        this.floor = new AdventuringDungeonFloor(this.manager, this.game, this);

        this.floor.component.mount(this.component.dungeon);

        this.floorCards = [];
        this.floorCount = 0;

        this.treasureCount = 0;
        this.trapCount = 0;
        this.fountainCount = 0;
    }

    onLoad() {
        super.onLoad();
    }

    nextTurn() {
        if(this.manager.encounter.isFighting) {
            this.manager.encounter.nextTurn();
        } else {
            this.floor.step();
        }
    }

    triggerEncounter(endOfFloor=false) {
        this.manager.encounter.startEncounter(this.progress == this.area.groups.length);
    }

    triggerTreasure() {
        let { min, max } = this.area.tiles.treasure.item_level;

        this.grantLoot(min, max);
    }

    triggerTrap() {
        let damage = this.area.tiles.trap.damage;

        this.manager.party.all.forEach(member => {
            member.damage(Math.floor(member.maxHitpoints * damage));
        });

        if(this.manager.party.all.every(member => member.dead)) {
            this.abandon();
        }
    }

    triggerFountain() {
        let heal = this.area.tiles.fountain.heal;
        this.manager.party.all.forEach(member => {
            if(member.dead) {
                member.revive(heal);
            } else {
                member.heal(Math.floor(member.maxHitpoints * heal));
            }
        });
    }

    grantLoot(min, max) {
        let baseId = this.area.loot[Math.floor(Math.random() * this.area.loot.length)];

        let base = this.game.items.equipment.registeredObjects.get(baseId);
        let randomItem = this.manager.lootgen.generateFromBase(base, min, max);
        if(randomItem)
            this.manager.stash.add(randomItem);
    }

    setArea(area) {
        this.area = area;
        this.floorCount = this.area.groups.length + 1;
    }

    updateFloorCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        for(let i=0; i < this.floorCount; i++) {
            if(this.floorCards[i] == undefined)
                this.floorCards[i] = new AdventuringCard(this.manager, this.game);

            this.floorCards[i].setName(i+1 == this.floorCount ? 'Boss Floor' : `Floor ${i+1}`);
            this.floorCards[i].setIcon(i+1 == this.floorCount ? cdnMedia('assets/media/main/hardcore.svg') : cdnMedia('assets/media/skills/combat/combat.svg'));
            this.floorCards[i].setFade(i < this.progress);
            this.floorCards[i].setHighlight(i == this.progress);
            this.manager.overview.cards.renderQueue.cards.add(this.floorCards[i]);
        }
    }

    startDungeon() {
        this.progress = 0;
        this.treasureCount = 0;
        this.trapCount = 0;
        this.fountainCount = 0;
        this.manager.overview.renderQueue.status = true;

        this.floor.generate(this.area.height, this.area.width);

        this.updateFloorCards();
        this.manager.dungeon.go();
        this.manager.start();
    }

    completeEncounter() {
        this.manager.encounter.reset();

        this.progress++;
        this.manager.overview.renderQueue.status = true;

        if(this.progress > this.area.groups.length) {
            this.complete();
        } else {
            this.updateFloorCards();
            this.floor.generate(this.area.height, this.area.width);
            this.manager.dungeon.go();
        }
    }

    reset() {
        this.progress = 0;
        this.manager.overview.renderQueue.status = true;

        this.floor.reset();
        this.manager.encounter.reset();
    }

    abandon() {
        this.reset();
        this.floorCount = 0;
        this.area = undefined;
        this.manager.stop();
        this.manager.crossroads.go();
    }

    complete() {
        this.grantLoot(this.area.item_level.min, this.area.item_level.max);

        if(!this.manager.party.all.every(hero => hero.dead)) {
            this.startDungeon();
        } else {
            this.reset();
            this.manager.stop();
            this.manager.crossroads.go();
        }
    }

    render() {
        this.floor.render();
    }

    encode(writer) {
        this.floor.encode(writer);
        writer.writeUint32(this.progress);
        writer.writeBoolean(this.area !== undefined);
        if(this.area !== undefined)
            writer.writeNamespacedObject(this.area);
        return writer;
    }

    decode(reader, version) {
        this.floor.decode(reader, version);
        this.progress = reader.getUint32();
        if (reader.getBoolean()) {
            const area = reader.getNamespacedObject(this.manager.areas);
            if (typeof area === 'string')
                this.setArea(undefined);
            else
                this.setArea(area);
        }
    }
}