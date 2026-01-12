const { loadModule } = mod.getContext(import.meta);

export class AdventuringTag extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this._name = data.name;
        this._media = data.media;
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.manager.getMediaURL(this._media);
    }
}
