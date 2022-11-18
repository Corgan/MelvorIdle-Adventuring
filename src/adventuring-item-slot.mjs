const { loadModule } = mod.getContext(import.meta);

export class AdventuringItemSlot extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this._media = data.media;
        if(data.pair)
            this.pair = data.pair;
    }

    get media() {
        return this.getMediaURL(this._media);
    }
}