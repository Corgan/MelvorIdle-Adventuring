const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringSlayersElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-slayers-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
    }
}
window.customElements.define('adventuring-slayers', AdventuringSlayersElement);