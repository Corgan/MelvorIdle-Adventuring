const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringSlayersUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-slayers-component');

        this.back = getElementFromFragment(this.$fragment, 'back', 'button');
    }
}