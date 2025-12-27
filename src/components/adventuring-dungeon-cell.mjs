export class AdventuringDungeonCellElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-dungeon-cell-template'));

        this.styling = getElementFromFragment(this._content, 'styling', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.tooltip = undefined;
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
        this.tooltip = tippy(this.styling, {
            content: '',
            allowHTML: true,
            placement: 'top'
        });
    }

    disconnectedCallback() {
        if(this.tooltip !== undefined) {
            this.tooltip.destroy();
            this.tooltip = undefined;
        }
    }

    setTooltipContent(content) {
        if(this.tooltip !== undefined) {
            this.tooltip.setContent(content);
        }
    }
}
window.customElements.define('adventuring-dungeon-cell', AdventuringDungeonCellElement);