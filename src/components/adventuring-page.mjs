const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringPageUIComponent extends AdventuringUIComponent {
    constructor(manager, game, template) {
        super(manager, game, template);

        this.page = getElementFromFragment(this.$fragment, 'page', 'div');
    }
}