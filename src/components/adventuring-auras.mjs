const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAurasUIComponent extends AdventuringUIComponent {
    constructor(manager, game,) {
        super(manager, game, 'adventuring-auras-component');

        this.auras = getElementFromFragment(this.$fragment, 'auras', 'div');
    }
}