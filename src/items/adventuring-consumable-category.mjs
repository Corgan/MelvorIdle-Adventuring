const { loadModule } = mod.getContext(import.meta);

export class AdventuringConsumableCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
        this.description = data.description || '';
        this.order = (data.order !== undefined) ? data.order : 0;
    }

    get name() {
        return this._name;
    }

    get media() {
        return this._media ? this.getMediaURL(this._media) : '';
    }

    getConsumables() {
        return this.manager.consumableTypes.allObjects.filter(c => c.category === this);
    }
}
