
export class AdventuringEquipmentPool extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name || 'Equipment Pool';

        this._itemData = data.items || [];
        this.items = []; // Array of { item: AdventuringBaseItem, weight: number }
    }

    postDataRegistration() {
        this.items = this._itemData.map(entry => {

            const id = typeof entry === 'string' ? entry : entry.id;
            const weight = typeof entry === 'string' ? 1 : (entry.weight !== undefined ? entry.weight : 1);
            const item = this.manager.baseItems.getObjectByID(id);

            if (!item) {
                console.warn(`[Adventuring] Equipment pool ${this.id}: Item not found: ${id}`);
                return null;
            }

            return { item, weight };
        }).filter(e => e !== null);
    }

    getAvailable() {
        return this.items.filter(entry => !entry.item.unlocked);
    }

    hasAvailable() {
        return this.items.some(entry => !entry.item.unlocked);
    }

    roll() {
        const available = this.getAvailable();
        if (available.length === 0) return null;

        const totalWeight = available.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;

        for (const entry of available) {
            roll -= entry.weight;
            if (roll <= 0) {
                return entry.item;
            }
        }

        return available[available.length - 1].item;
    }
}
