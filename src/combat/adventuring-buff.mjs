const { loadModule } = mod.getContext(import.meta);

const { AdventuringAura } = await loadModule('src/combat/adventuring-aura.mjs');

export class AdventuringBuff extends AdventuringAura {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
        this.auraType = 'buff';
    }

    get isBuff() { return true; }
    get isDebuff() { return false; }
}