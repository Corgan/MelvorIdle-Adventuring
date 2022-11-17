const { loadModule } = mod.getContext(import.meta);

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

export class AdventuringItemPool extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.pool = new AdventuringWeightedTable(this.manager, this.game);
        this.pool.loadTable(data.types);
    }
}