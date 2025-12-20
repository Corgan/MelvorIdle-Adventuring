const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');
const { AdventuringStatsElement } = await loadModule('src/components/adventuring-stats.mjs');

export class AdventuringJobDetailsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-job-details-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.scaling = getElementFromFragment(this._content, 'scaling', 'div');
        this.equipable = getElementFromFragment(this._content, 'equipable', 'div');
        this.generators = getElementFromFragment(this._content, 'generators', 'div');
        this.spenders = getElementFromFragment(this._content, 'spenders', 'div');
    }
}
window.customElements.define('adventuring-job-details', AdventuringJobDetailsElement);