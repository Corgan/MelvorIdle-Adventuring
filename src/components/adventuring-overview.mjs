const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringOverviewUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-overview-component');

        this.statusText = getElementFromFragment(this.$fragment, 'status-text', 'h5');

        this.trainerButton = getElementFromFragment(this.$fragment, 'trainer-button', 'button');
        this.armoryButton = getElementFromFragment(this.$fragment, 'armory-button', 'button');
        this.stashButton = getElementFromFragment(this.$fragment, 'stash-button', 'button');
        this.bestiaryButton = getElementFromFragment(this.$fragment, 'bestiary-button', 'button');
        this.crossroadsButton = getElementFromFragment(this.$fragment, 'crossroads-button', 'button');
        this.abandonButton = getElementFromFragment(this.$fragment, 'abandon-button', 'button');

        this.turnProgress = getElementFromFragment(this.$fragment, 'turn-progress', 'div');
        this.turnProgressBar = new ProgressBar(getElementFromFragment(this.$fragment, 'turn-progress-bar', 'div'));

        this.healProgress = getElementFromFragment(this.$fragment, 'heal-progress', 'div');
        this.healProgressBar = new ProgressBar(getElementFromFragment(this.$fragment, 'heal-progress-bar', 'div'));

        this.cards = getElementFromFragment(this.$fragment, 'cards', 'div');
        this.log = getElementFromFragment(this.$fragment, 'log', 'div');
    }
}