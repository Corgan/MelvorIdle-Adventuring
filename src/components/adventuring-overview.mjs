const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringOverviewUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-overview-component');

        this.statusText = getElementFromFragment(this.$fragment, 'status-text', 'h5');

        this.buttons = getElementFromFragment(this.$fragment, 'buttons', 'div');

        this.turnProgress = getElementFromFragment(this.$fragment, 'turn-progress', 'div');
        this.turnProgressBar = new ProgressBar(getElementFromFragment(this.$fragment, 'turn-progress-bar', 'div'));

        this.cards = getElementFromFragment(this.$fragment, 'cards', 'div');
        this.log = getElementFromFragment(this.$fragment, 'log', 'div');
    }
}