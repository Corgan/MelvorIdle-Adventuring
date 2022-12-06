const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringBestiaryUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-bestiary-component');
        
        this.monsters = getElementFromFragment(this.$fragment, 'monsters', 'div');
    }
}