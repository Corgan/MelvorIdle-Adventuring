const { loadModule } = mod.getContext(import.meta);

class AdventuringWeightedTable {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.totalWeight = 0;
        this.table = [];
    }
    get size() {
        return this.table.length;
    }
    get weight() {
        return this.totalWeight;
    }
    get sortedDropsArray() {
        return [...this.table].sort((a,b)=>b.weight - a.weight);
    }
    reset() {
        this.table = [];
        this.totalWeight = 0;
    }
    loadTable(data) {
        this.reset();
        data.forEach(({ id, weight })=>{
            this.totalWeight += weight;
            this.table.push({
                id,
                weight,
            });
        });
    }
    getEntry() {
        const dropRoll = Math.floor(Math.random() * this.totalWeight);
        let itemWeight = 0;
        const lootIndex = this.table.findIndex(({ weight })=> {
            itemWeight += weight;
            return dropRoll < itemWeight;
        });
        const drop = this.table[lootIndex];
        return drop.id;
    }
}

export { AdventuringWeightedTable }