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

        this.component = new AdventuringDungeonUIComponent(this.manager, this.game, this);

        this.floor = new AdventuringDungeonFloor(this.manager, this.game, this);

        this.floor.component.mount(this.component.dungeon);

        this.groupGenerator = new AdventuringWeightedTable(this.manager, this.game);
        this.tileLootGenerator = new AdventuringWeightedTable(this.manager, this.game);

        this.floorCards = [];
        this.numFloors = 0;

        this.tileCount = new Map();
        
        this.exploreTimer = new Timer('Explore', () => this.explore());
        this.exploreInterval = 1500;
    }

    get currentFloor() {
        return this.area.floors[Math.max(0, Math.min(this.progress, this.numFloors))];
    }

    onLoad() {
        super.onLoad();
        this.floor.onLoad();
    }

    postDataRegistration() {
        super.postDataRegistration();
        this.floor.postDataRegistration();
    }

    explore() {
        this.floor.step();
        this.exploreTimer.start(this.exploreInterval);
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    triggerTile(tile) {
        if(tile.type.id === 'adventuring:start') {
            this.manager.log.add(`Starting ${this.area.name} floor ${this.progress+1}`);
            return;
        }
        
        if(tile.type.id === 'adventuring:exit' || tile.type.id === 'adventuring:boss') {
            this.manager.log.add(`Starting floor exit encounter`);
            this.manager.encounter.generateEncounter(true);
            this.manager.encounter.startEncounter();
            return;
        }

        if(tile.type.id === 'adventuring:encounter') {
            this.manager.log.add(`Starting random encounter`);
            this.manager.encounter.generateEncounter();
            this.manager.encounter.startEncounter();
            return;
        }
        
        if(tile.type.effect !== undefined) {
            if(tile.type.effect.type === "damage") {
                let damage = tile.type.effect.amount;
        
                this.manager.party.all.forEach(member => {
                    let amount = Math.floor(member.maxHitpoints * damage);
                    member.damage(amount);
                    this.manager.log.add(`${tile.type.name} did ${amount} damage to ${member.name}`);
                });
        
                if(this.manager.party.all.every(member => member.dead)) {
                    this.abandon();
                }
            }

            if(tile.type.effect.type === "heal") {
                let heal = tile.type.effect.amount;
                this.manager.party.all.forEach(member => {
                    if(member.dead) {
                        member.revive(heal);
                        this.manager.log.add(`${tile.type.name} revived ${member.name} to ${Math.floor(100 * heal)} health.`);
                    } else {
                        let amount = Math.floor(member.maxHitpoints * heal);
                        member.heal(amount);
                        this.manager.log.add(`${tile.type.name} healed ${member.name} for ${amount} health.`);
                    }
                });
            }

            if(tile.type.effect.type === "loot") {
                this.tileLootGenerator.loadTable(tile.type.effect.pool);
                let { id, qty } = this.tileLootGenerator.getEntry();
                this.manager.stash.add(id, qty);
            }
        }
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

            this.floorCards[i].name = (i+1 == this.numFloors ? 'Boss Floor' : `Floor ${i+1}`);
            this.floorCards[i].renderQueue.name = true;

            this.floorCards[i].icon = (i+1 == this.numFloors ? cdnMedia('assets/media/main/hardcore.svg') : cdnMedia('assets/media/skills/combat/combat.svg'));
            this.floorCards[i].renderQueue.icon = true;
            
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
        
        this.tileCount.clear();
        this.manager.tiles.allObjects.forEach(tile => {
            this.tileCount.set(tile, 0);
        });

        this.manager.overview.renderQueue.status = true;
        this.next();
        this.manager.start();
    }

    reset() {
        this.area = undefined;
        this.numFloors = 0;
        this.progress = 0;
        this.exploreTimer.stop();
        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;

        this.groupGenerator.reset();

        this.floor.reset();
        this.manager.encounter.reset();
    }

    abandon() {
        this.manager.log.add(`Abandoned ${this.area.name} on floor ${this.progress+1}`);
        this.reset();

        this.manager.stop();
        this.manager.crossroads.go();
    }

    complete() {
        this.manager.log.add(`Completed ${this.area.name}`);

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
        this.exploreTimer.encode(writer);
        this.floor.encode(writer);
        writer.writeUint32(this.progress);
        writer.writeBoolean(this.area !== undefined);
        if(this.area !== undefined)
            writer.writeNamespacedObject(this.area);
        return writer;
    }

    decode(reader, version) {
        this.exploreTimer.decode(reader, version);
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