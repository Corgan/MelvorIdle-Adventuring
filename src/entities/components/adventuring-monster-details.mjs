const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringMonsterDetailsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-monster-details-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.tags = getElementFromFragment(this._content, 'tags', 'p');
        
        this.killCount = getElementFromFragment(this._content, 'killCount', 'span');
        this.masteryLevel = getElementFromFragment(this._content, 'masteryLevel', 'span');
        this.masteryProgress = getElementFromFragment(this._content, 'mastery-progress', 'progress-bar');
        
        this.stats = getElementFromFragment(this._content, 'stats', 'div');
        this.abilities = getElementFromFragment(this._content, 'abilities', 'div');
        
        this.dropLock = getElementFromFragment(this._content, 'dropLock', 'small');
        this.dropRows = getElementFromFragment(this._content, 'dropRows', 'div');
        
        this.locations = getElementFromFragment(this._content, 'locations', 'div');
    }
}
window.customElements.define('adventuring-monster-details', AdventuringMonsterDetailsElement);
