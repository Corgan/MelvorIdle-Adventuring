export class AdventuringJobElement extends HTMLElement {
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
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.clickable, {
            content: '',
            allowHTML: true,
            hideOnClick: false
        });
    }

    disconnectedCallback() {
        if (this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }
}
window.customElements.define('adventuring-job', AdventuringJobElement);