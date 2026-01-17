const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');
const { AdventuringStatsElement } = await loadModule('src/core/components/adventuring-stats.mjs');

export class AdventuringJobDetailsElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-job-details-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.nameText = getElementFromFragment(this._content, 'name', 'h3');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.scaling = getElementFromFragment(this._content, 'scaling', 'div');
        this.equipable = getElementFromFragment(this._content, 'equipable', 'div');
        this.abilitiesSection = getElementFromFragment(this._content, 'abilities-section', 'div');
        this.abilitiesList = getElementFromFragment(this._content, 'abilities-list', 'div');

        // Combat stats section
        this.jobStatsSection = getElementFromFragment(this._content, 'job-stats-section', 'div');
        this.jobBestEndless = getElementFromFragment(this._content, 'job-best-endless', 'div');
        this.jobRunsCompleted = getElementFromFragment(this._content, 'job-runs-completed', 'div');
    }
}
window.customElements.define('adventuring-job-details', AdventuringJobDetailsElement);