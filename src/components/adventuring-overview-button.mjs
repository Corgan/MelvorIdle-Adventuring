const { loadModule } = mod.getContext(import.meta);

export class AdventuringOverviewButtonElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-overview-button-template'));

        this.button = getElementFromFragment(this._content, 'button', 'button');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-overview-button', AdventuringOverviewButtonElement);