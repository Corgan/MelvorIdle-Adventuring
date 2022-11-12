const { loadModule } = mod.getContext(import.meta);
const { AdventuringAbility } = await loadModule('src/adventuring-ability.mjs');

export class AdventuringGenerator extends AdventuringAbility {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
        this.amount = data.amount;
    }
}