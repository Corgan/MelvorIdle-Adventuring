const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringAuraUIComponent extends AdventuringUIComponent {
    constructor(manager, game,) {
        super(manager, game, 'adventuring-aura-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.name = getElementFromFragment(this.$fragment, 'name', 'small');
        this.description = getElementFromFragment(this.$fragment, 'description', 'small');
    }
}