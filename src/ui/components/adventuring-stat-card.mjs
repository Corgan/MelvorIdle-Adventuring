
export class AdventuringStatCardElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-card-template'));

        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.value = getElementFromFragment(this._content, 'value', 'h4');
        this.label = getElementFromFragment(this._content, 'label', 'small');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setStat({ value, label, valueClass = 'text-warning' }) {
        this.value.textContent = value;
        this.value.className = `${valueClass} mb-0`;
        this.label.textContent = label;
    }

    setColumnClass(colClass) {
        this.container.className = `${colClass} text-center`;
    }
}
window.customElements.define('adventuring-stat-card', AdventuringStatCardElement);
