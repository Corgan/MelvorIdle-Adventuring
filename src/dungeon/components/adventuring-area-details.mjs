const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');

export class AdventuringAreaDetailsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-area-details-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.description = getElementFromFragment(this._content, 'description', 'p');

        this.floorCount = getElementFromFragment(this._content, 'floorCount', 'span');
        this.areaSize = getElementFromFragment(this._content, 'areaSize', 'span');

        this.masteryLevel = getElementFromFragment(this._content, 'masteryLevel', 'span');
        this.masteryProgress = getElementFromFragment(this._content, 'mastery-progress', 'progress-bar');
        this.bestEndless = getElementFromFragment(this._content, 'bestEndless', 'span');
        this.milestones = getElementFromFragment(this._content, 'milestones', 'div');

        this.monsters = getElementFromFragment(this._content, 'monsters', 'div');

        this.drops = getElementFromFragment(this._content, 'drops', 'div');
        this.dropsLock = getElementFromFragment(this._content, 'dropsLock', 'small');
    }
}
window.customElements.define('adventuring-area-details', AdventuringAreaDetailsElement);
