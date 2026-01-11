const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringJobElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');

        this.progressContainer = getElementFromFragment(this._content, 'progress-container', 'div');
        this.masteryProgress = getElementFromFragment(this._content, 'mastery-progress', 'progress-bar');

        this._tooltipTarget = this.clickable;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }
}
window.customElements.define('adventuring-job', AdventuringJobElement);