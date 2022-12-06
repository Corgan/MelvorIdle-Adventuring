const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringArmoryUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-armory-component');
        this.items = getElementFromFragment(this.$fragment, 'items', 'div');

        
        this.details = getElementFromFragment(this.$fragment, 'details', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'name', 'h5');
        this.base = getElementFromFragment(this.$fragment, 'base', 'div');
        this.scaling = getElementFromFragment(this.$fragment, 'scaling', 'div');
        this.materials = getElementFromFragment(this.$fragment, 'materials', 'div');
        this.upgradeButton = getElementFromFragment(this.$fragment, 'upgrade-button', 'button');
    }
}