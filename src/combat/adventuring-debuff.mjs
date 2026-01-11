const { loadModule } = mod.getContext(import.meta);

const { AdventuringAura } = await loadModule('src/combat/adventuring-aura.mjs');

export class AdventuringDebuff extends AdventuringAura {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
        this.auraType = 'debuff';
    }

    get isBuff() { return false; }
    get isDebuff() { return true; }
}