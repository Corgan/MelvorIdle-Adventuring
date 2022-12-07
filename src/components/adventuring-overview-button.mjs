const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringOverviewButtonUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-overview-button-component');

        this.button = getElementFromFragment(this.$fragment, 'button', 'button');
        this.name = getElementFromFragment(this.$fragment, 'name', 'span');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
    }
}