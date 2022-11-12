const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringCrossroadsUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-crossroads-component');
        
        this.areas = getElementFromFragment(this.$fragment, 'areas', 'div');
    }
}