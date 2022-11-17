const { loadModule } = mod.getContext(import.meta);

export class AdventuringItemTier extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.range = data.range;
    }
}