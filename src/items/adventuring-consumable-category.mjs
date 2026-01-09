const { loadModule } = mod.getContext(import.meta);

/**
 * Represents a category of consumables for organization in alchemy/crafting buildings.
 * Examples: drink, potion, oil, food, charm, scroll, banner, ward, bomb, salve
 */
export class AdventuringConsumableCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this.description = data.description || '';
        
        // Display order for sorting in UI
        this.order = (data.order !== undefined) ? data.order : 0;
    }

    get name() {
        return this._name;
    }

    get media() {
        return this._media ? this.getMediaURL(this._media) : '';
    }

    /**
     * Get all consumables in this category
     * @returns {AdventuringConsumable[]}
     */
    getConsumables() {
        return this.manager.consumableTypes.allObjects.filter(c => c.category === this);
    }
}
