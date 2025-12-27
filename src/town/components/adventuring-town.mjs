const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringTownElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-town-template');
        
        this.buildings = getElementFromFragment(this._content, 'buildings', 'div');
    }
}
window.customElements.define('adventuring-town', AdventuringTownElement);