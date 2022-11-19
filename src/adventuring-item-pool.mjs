const { loadModule } = mod.getContext(import.meta);

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

export class AdventuringItemPool extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.type = data.type;
        this.entries = data.entries;
        
        this.pool = new AdventuringWeightedTable(this.manager, this.game);
        this.pool.loadTable(data.entries);
    }

    getEntry() {
        if(this.type === "type")
            return this.pool.getEntry();
        
        if(this.type == "pool") {
            let poolID = this.pool.getEntry();
            let itemPool = this.manager.itemPools.getObjectByID(poolID);
            return itemPool.getEntry();
        }
    }
}