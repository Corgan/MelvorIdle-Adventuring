/**
 * AdventuringLootTable - A named, reusable loot table.
 * Loot tables can be referenced by monsters to share common drop pools.
 */
export class AdventuringLootTable extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name || 'Loot Table';
        
        // Array of loot entries (same format as monster loot)
        this.entries = data.entries || [];
    }
    
    /**
     * Get all entries from this table
     * @returns {Array} Array of loot entry objects
     */
    getEntries() {
        return this.entries;
    }
}
