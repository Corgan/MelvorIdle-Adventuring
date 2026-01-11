const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringCrossroadsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-crossroads-template');

        this.areas = getElementFromFragment(this._content, 'areas', 'div');
    }
}
window.customElements.define('adventuring-crossroads', AdventuringCrossroadsElement);