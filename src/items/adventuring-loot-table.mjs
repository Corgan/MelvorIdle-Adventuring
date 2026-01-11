
export class AdventuringLootTable extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name || 'Loot Table';
        this.entries = data.entries || [];
    }

    getEntries() {
        return this.entries;
    }
}
