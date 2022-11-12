const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringPageUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-page-component');
        this.party = getElementFromFragment(this.$fragment, 'party', 'div');

        this.overview = getElementFromFragment(this.$fragment, 'overview', 'div');

        this.subpages = getElementFromFragment(this.$fragment, 'subpages', 'div');
    }
}