const { loadModule } = mod.getContext(import.meta);

export class AdventuringMaterialCategory extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
    }
}
