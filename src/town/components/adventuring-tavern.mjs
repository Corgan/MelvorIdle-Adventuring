const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringTavernElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-tavern-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.drinks = getElementFromFragment(this._content, 'drinks', 'div');
        this.activeBuffs = getElementFromFragment(this._content, 'active-buffs', 'div');
    }
}
window.customElements.define('adventuring-tavern', AdventuringTavernElement);