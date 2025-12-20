const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringStashElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-stash-template');

        this.materials = getElementFromFragment(this._content, 'materials', 'div');
    }
}
window.customElements.define('adventuring-stash', AdventuringStashElement);