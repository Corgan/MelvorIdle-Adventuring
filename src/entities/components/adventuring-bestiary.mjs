const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringBestiaryElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-bestiary-template');
        
        this.monsters = getElementFromFragment(this._content, 'monsters', 'div');
    }
}
window.customElements.define('adventuring-bestiary', AdventuringBestiaryElement);