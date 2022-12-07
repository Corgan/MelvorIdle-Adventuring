const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringTownUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-town-component');
        
        this.buildings = getElementFromFragment(this.$fragment, 'buildings', 'div');
    }
}