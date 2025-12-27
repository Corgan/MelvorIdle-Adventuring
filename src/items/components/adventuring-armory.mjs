const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringArmoryElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-armory-template');

        this.items = getElementFromFragment(this._content, 'items', 'div');
        this.back = getElementFromFragment(this._content, 'back', 'button');
        
        // Category dropdown
        this.categoryDropdownButton = getElementFromFragment(this._content, 'category-dropdown-button', 'button');
        this.optionMelee = getElementFromFragment(this._content, 'option-melee', 'a');
        this.optionRanged = getElementFromFragment(this._content, 'option-ranged', 'a');
        this.optionMagic = getElementFromFragment(this._content, 'option-magic', 'a');
        this.optionOffhands = getElementFromFragment(this._content, 'option-offhands', 'a');
        this.optionHeavy = getElementFromFragment(this._content, 'option-heavy', 'a');
        this.optionMedium = getElementFromFragment(this._content, 'option-medium', 'a');
        this.optionLight = getElementFromFragment(this._content, 'option-light', 'a');
        this.optionAccessories = getElementFromFragment(this._content, 'option-accessories', 'a');
        
        this.details = getElementFromFragment(this._content, 'details', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'h5');
        this.base = getElementFromFragment(this._content, 'base', 'div');
        this.scaling = getElementFromFragment(this._content, 'scaling', 'div');
        this.materials = getElementFromFragment(this._content, 'materials', 'div');
        this.upgradeButton = getElementFromFragment(this._content, 'upgrade-button', 'button');
    }
}
window.customElements.define('adventuring-armory', AdventuringArmoryElement);