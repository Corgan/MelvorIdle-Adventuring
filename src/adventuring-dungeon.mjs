const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

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

        this.groupGenerator = new AdventuringWeightedTable(this.manager, this.game);

        this.floorCards = [];
        this.numFloors = 0;

        this.treasureCount = 0;
        this.trapCount = 0;
        this.fountainCount = 0;
    }

    get currentFloor() {
        return this.area.floors[Math.max(0, Math.min(this.progress, this.numFloors))];
    }

    onLoad() {
        super.onLoad();
        this.floor.onLoad();
    }

    nextTurn() {
        if(this.manager.encounter.isFighting) {
            this.manager.encounter.nextTurn();
        } else {
            this.floor.step();
        }
    }

    triggerExit() {
        this.manager.encounter.generateEncounter(true);
        this.manager.encounter.startEncounter();
    }

    triggerEncounter() {
        this.manager.encounter.generateEncounter();
        this.manager.encounter.startEncounter();
    }

    triggerTreasure() {
        let { min, max } = this.area.tiles.treasure.loot.range;

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

    grantLoot(min, max, fromTreasure=false) {
        let lootGen = fromTreasure && this.area.treasurePoolGenerator !== undefined ? this.area.treasurePoolGenerator : this.area.lootPoolGenerator;
        
        let poolID = lootGen.getEntry();
        let itemPool = this.manager.itemPools.getObjectByID(poolID);
        let itemType = itemPool.getEntry();
        let rolledLevel = Math.floor(Math.random() * (max - min + 1)) + min;

        let itemTiers = this.manager.itemTiers.allObjects.filter(tier => {
            return rolledLevel >= tier.range.min && rolledLevel <= tier.range.max;
        });
        let itemTier = itemTiers[Math.floor(Math.random() * itemTiers.length)];

        let baseItems = this.manager.baseItems.allObjects.filter(item => {
            return item.tier == itemTier.id && item.type == itemType;
        });
        let baseItem = baseItems[Math.floor(Math.random() * baseItems.length)];
        
        let randomItem = this.manager.lootgen.generateFromBase(baseItem, min, max, rolledLevel);
        
        if(randomItem)
            this.manager.stash.add(randomItem);
    }

    setArea(area) {
        this.area = area;
        this.numFloors = this.area.floors.length;

        if(this.currentFloor !== undefined)
            this.groupGenerator.loadTable(this.currentFloor.monsters);
    }

    updateFloorCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        for(let i=0; i < this.numFloors; i++) {
            if(this.floorCards[i] == undefined)
                this.floorCards[i] = new AdventuringCard(this.manager, this.game);

            this.floorCards[i].setName(i+1 == this.numFloors ? 'Boss Floor' : `Floor ${i+1}`);
            this.floorCards[i].setIcon(i+1 == this.numFloors ? cdnMedia('assets/media/main/hardcore.svg') : cdnMedia('assets/media/skills/combat/combat.svg'));
            this.floorCards[i].setFade(i < this.progress);
            this.floorCards[i].setHighlight(i == this.progress);
            this.manager.overview.cards.renderQueue.cards.add(this.floorCards[i]);
        }
    }

    next() {
        if(this.currentFloor !== undefined)
            this.groupGenerator.loadTable(this.currentFloor.monsters);
        this.floor.generate(this.area.height, this.area.width);

        this.updateFloorCards();
        this.manager.dungeon.go();
    }

    start() {
        this.progress = 0;
        this.treasureCount = 0;
        this.trapCount = 0;
        this.fountainCount = 0;
        this.manager.overview.renderQueue.status = true;
        this.next();
        this.manager.start();
    }

    reset() {
        this.area = undefined;
        this.numFloors = 0;
        this.progress = 0;
        this.manager.overview.renderQueue.status = true;

        this.groupGenerator.reset();

        this.floor.reset();
        this.manager.encounter.reset();
    }

    abandon() {
        this.reset();

        this.manager.stop();
        this.manager.crossroads.go();
    }

    complete() {
        this.grantLoot(this.area.loot.range.min, this.area.loot.range.max);

        if(!this.manager.party.all.every(hero => hero.dead)) {
            this.start();
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