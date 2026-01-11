
export class AdventuringRequirementElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-requirement-template'));

        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.status = getElementFromFragment(this._content, 'status', 'span');
        this.text = getElementFromFragment(this._content, 'text', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setRequirement({ text, met, showIcon = true }) {
        if (showIcon) {
            this.status.textContent = '';
            this.status.className = `mr-1 ${met ? 'fas fa-check text-success' : 'fas fa-times text-danger'}`;
        } else {
            this.status.textContent = '';
            this.status.className = '';
        }

        this.text.textContent = text;
        this.container.className = met ? 'text-success' : 'text-warning';
    }
}
window.customElements.define('adventuring-requirement', AdventuringRequirementElement);
