export class AdventuringMaterialElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-material-template'));

        this.clickable = getElementFromFragment(this._content, 'clickable', 'div');
        this.border = getElementFromFragment(this._content, 'border', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.count = getElementFromFragment(this._content, 'count', 'small');
        this.newBadge = getElementFromFragment(this._content, 'new-badge', 'span');
        this._tooltipContent = '';
    }

    mount(parent) {
        parent.append(this);
    }

    setTooltipContent(content) {
        this._tooltipContent = content;
        if (this.tooltip) {
            this.tooltip.setContent(content);
        }
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.clickable, {
            content: this._tooltipContent,
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
window.customElements.define('adventuring-material', AdventuringMaterialElement);