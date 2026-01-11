const { loadModule } = mod.getContext(import.meta);

const { AdventuringAbility } = await loadModule('src/combat/adventuring-ability.mjs');

export class AdventuringGenerator extends AdventuringAbility {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
        this.abilityType = 'generator';
    }

    get isGenerator() { return true; }
    get isSpender() { return false; }
}