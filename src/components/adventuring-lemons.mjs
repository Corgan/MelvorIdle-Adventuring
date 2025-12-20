const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringLemonsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-lemons-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
    }
}
window.customElements.define('adventuring-lemons', AdventuringLemonsElement);