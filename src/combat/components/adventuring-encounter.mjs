const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringEncounterElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-encounter-template');

        this.enemies = getElementFromFragment(this._content, 'enemies', 'div');
    }
}
window.customElements.define('adventuring-encounter', AdventuringEncounterElement);