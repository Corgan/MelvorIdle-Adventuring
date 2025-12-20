const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringArmoryElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-armory-template');

        this.items = getElementFromFragment(this._content, 'items', 'div');
        this.back = getElementFromFragment(this._content, 'back', 'button');
        
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