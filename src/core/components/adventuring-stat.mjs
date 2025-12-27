export class AdventuringStatElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-template'));
        
        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.value = getElementFromFragment(this._content, 'value', 'small');
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
        this.tooltip = tippy(this.styling, {
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

    show() {
        showElement(this);
    }

    hide() {
        hideElement(this);
    }
}
window.customElements.define('adventuring-stat', AdventuringStatElement);