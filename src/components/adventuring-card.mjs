const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringCardUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-card-component');

        this.styling = getElementFromFragment(this.$fragment, 'styling', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'text', 'small');
        this.action = getElementFromFragment(this.$fragment, 'action', 'small');
    }
}