const { loadModule } = mod.getContext(import.meta);

const { AdventuringAura } = await loadModule('src/adventuring-aura.mjs');

export class AdventuringBuff extends AdventuringAura {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);
    }
}