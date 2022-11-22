const { loadModule } = mod.getContext(import.meta);

export class AdventuringMonster extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name;
        this._media = data.media;
        this.stats = data.stats;
        this.xp = data.xp;
        this.generator = data.generator;
        this.spender = data.spender;
        this.passives = data.passives;
    }

    get media() {
        return this.getMediaURL(this._media);
    }
}