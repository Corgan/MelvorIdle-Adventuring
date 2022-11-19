const { loadModule } = mod.getContext(import.meta);

export class AdventuringItemType extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.name = data.name;
        this.slots = data.slots;
        if(data.occupies)
            this.occupies = data.occupies;
        if(data.pairs)
            this.pairs = data.pairs;
    }
}