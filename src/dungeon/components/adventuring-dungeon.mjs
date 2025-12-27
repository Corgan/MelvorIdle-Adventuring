const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringDungeonElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-dungeon-template');
        
        this.dungeon = getElementFromFragment(this._content, 'dungeon', 'div');
    }
}
window.customElements.define('adventuring-dungeon', AdventuringDungeonElement);