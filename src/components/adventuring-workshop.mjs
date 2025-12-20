const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringWorkshopElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-workshop-template');

        this.orders = getElementFromFragment(this._content, 'orders', 'div');
        this.store = getElementFromFragment(this._content, 'store', 'div');

        this.productDropdown = getElementFromFragment(this._content, 'product-drop-down-container', 'div');
        this.productButton = getElementFromFragment(this._content, 'product-button', 'button');
        this.productRecipeOptions = getElementFromFragment(this._content, 'product-recipe-options-container', 'div');
        this.count = getElementFromFragment(this._content, 'count', 'input');
        this.submit = getElementFromFragment(this._content, 'submit', 'button');

        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.back = getElementFromFragment(this._content, 'back', 'button');
    }
}
window.customElements.define('adventuring-workshop', AdventuringWorkshopElement);