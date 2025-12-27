const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringLemonsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-lemons-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.quote = getElementFromFragment(this._content, 'quote', 'h5');
        this.buyBtn = getElementFromFragment(this._content, 'buy-btn', 'button');
        this.squashBtn = getElementFromFragment(this._content, 'squash-btn', 'button');
        this.stats = getElementFromFragment(this._content, 'stats', 'div');
        this.secrets = getElementFromFragment(this._content, 'secrets', 'div');
    }
}
window.customElements.define('adventuring-lemons', AdventuringLemonsElement);