const { loadModule } = mod.getContext(import.meta);

export class AdventuringItemMaterial extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
    }
}