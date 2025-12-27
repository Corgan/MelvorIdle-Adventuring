const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringTrainerElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-trainer-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.jobs = getElementFromFragment(this._content, 'jobs', 'div');
        this.categoryFilter = getElementFromFragment(this._content, 'category-filter', 'select');
    }
}
window.customElements.define('adventuring-trainer', AdventuringTrainerElement);