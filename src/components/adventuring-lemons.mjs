const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringLemonsUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-lemons-component');

        this.back = getElementFromFragment(this.$fragment, 'back', 'button');
    }
}