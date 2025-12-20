const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringTavernElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-tavern-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
    }
}
window.customElements.define('adventuring-tavern', AdventuringTavernElement);