const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');

export class AdventuringWorkOrderUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-work-order-component');

        this.style = getElementFromFragment(this.$fragment, 'style', 'div');
        this.active = getElementFromFragment(this.$fragment, 'active', 'div');
        this.inactive = getElementFromFragment(this.$fragment, 'inactive', 'div');
        this.icon = getElementFromFragment(this.$fragment, 'icon', 'img');
        this.name = getElementFromFragment(this.$fragment, 'name', 'span');
        this.completed = getElementFromFragment(this.$fragment, 'completed', 'span');
        this.count = getElementFromFragment(this.$fragment, 'count', 'span');
        this.cancel = getElementFromFragment(this.$fragment, 'cancel', 'button');
    }
}