const { loadModule } = mod.getContext(import.meta);

export class AdventuringStat extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this._media = data.media;
        if(data.base !== undefined)
            this.base = data.base;
    }

    get media() {
        return this.getMediaURL(this._media);
    }
}