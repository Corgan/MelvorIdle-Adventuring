const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringWorkshopElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-workshop-template');

        this.orders = getElementFromFragment(this._content, 'orders', 'div');
        this.store = getElementFromFragment(this._content, 'store', 'div');
        this.storeEmpty = getElementFromFragment(this._content, 'store-empty', 'div');

        // Output type tabs
        this.outputTypeTabs = getElementFromFragment(this._content, 'output-type-tabs', 'div');
        this.tabItem = getElementFromFragment(this._content, 'tab-item', 'button');
        this.tabMaterial = getElementFromFragment(this._content, 'tab-material', 'button');
        this.tabConsumable = getElementFromFragment(this._content, 'tab-consumable', 'button');
        this.tabConversion = getElementFromFragment(this._content, 'tab-conversion', 'button');
        
        // Tier selector
        this.tierSelector = getElementFromFragment(this._content, 'tier-selector', 'div');
        this.tier1 = getElementFromFragment(this._content, 'tier-1', 'button');
        this.tier2 = getElementFromFragment(this._content, 'tier-2', 'button');
        this.tier3 = getElementFromFragment(this._content, 'tier-3', 'button');
        this.tier4 = getElementFromFragment(this._content, 'tier-4', 'button');
        this.tierButtons = [this.tier1, this.tier2, this.tier3, this.tier4];
        
        // Product list and selection
        this.productList = getElementFromFragment(this._content, 'product-list', 'div');
        this.selectedProductDisplay = getElementFromFragment(this._content, 'selected-product-display', 'div');
        this.selectedProductIcon = getElementFromFragment(this._content, 'selected-product-icon', 'img');
        this.selectedProductName = getElementFromFragment(this._content, 'selected-product-name', 'div');
        this.noProductSelected = getElementFromFragment(this._content, 'no-product-selected', 'div');
        
        this.count = getElementFromFragment(this._content, 'count', 'input');
        this.submit = getElementFromFragment(this._content, 'submit', 'button');
        this.costDisplay = getElementFromFragment(this._content, 'cost-display', 'div');
        this.requirementsDisplay = getElementFromFragment(this._content, 'requirements-display', 'div');

        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.back = getElementFromFragment(this._content, 'back', 'button');
    }
}
window.customElements.define('adventuring-workshop', AdventuringWorkshopElement);