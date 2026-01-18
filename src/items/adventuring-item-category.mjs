const { loadModule } = mod.getContext(import.meta);

/**
 * NamespacedObject representing an equipment category for organizing items in the armory.
 * Categories can be: melee, ranged, magic, heavy, medium, light, accessories, artifacts, jobweapons
 */
export class AdventuringItemCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this.order = data.order !== undefined ? data.order : 0;
        
        // Optional: icon for the category tab
        if (data.media !== undefined) {
            this._media = data.media;
        }
    }

    get media() {
        if (this._media) {
            return this.manager.game.getMediaURL(this._media);
        }
        return undefined;
    }
}
