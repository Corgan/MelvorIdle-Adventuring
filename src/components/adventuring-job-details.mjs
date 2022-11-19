const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');
const { AdventuringLevelsUIComponent } = await loadModule('src/components/adventuring-levels.mjs');

export class AdventuringJobDetailsUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-job-details-component');

        this.name = getElementFromFragment(this.$fragment, 'name', 'h3');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');

        this.scaling = new AdventuringLevelsUIComponent(this.manager, this.game);
        this.scaling.mount(getElementFromFragment(this.$fragment, 'scaling', 'div'));

        this.equipable = getElementFromFragment(this.$fragment, 'equipable', 'div');

        this.generators = getElementFromFragment(this.$fragment, 'generators', 'div');
        this.spenders = getElementFromFragment(this.$fragment, 'spenders', 'div');
    }
}