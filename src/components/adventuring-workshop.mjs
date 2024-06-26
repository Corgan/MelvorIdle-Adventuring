const { loadModule } = mod.getContext(import.meta);

const { AdventuringPageUIComponent } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringWorkshopUIComponent extends AdventuringPageUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-workshop-component');

        this.orders = getElementFromFragment(this.$fragment, 'orders', 'div');
        this.store = getElementFromFragment(this.$fragment, 'store', 'div');

        this.productDropdown = getElementFromFragment(this.$fragment, 'product-drop-down-container', 'div');
        this.productButton = getElementFromFragment(this.$fragment, 'product-button', 'button');
        this.productRecipeOptions = getElementFromFragment(this.$fragment, 'product-recipe-options-container', 'div');
        this.count = getElementFromFragment(this.$fragment, 'count', 'input');
        this.submit = getElementFromFragment(this.$fragment, 'submit', 'button');

        this.name = getElementFromFragment(this.$fragment, 'name', 'h3');
        this.back = getElementFromFragment(this.$fragment, 'back', 'button');
    }
}