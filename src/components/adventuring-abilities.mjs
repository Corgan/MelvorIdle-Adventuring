const { loadModule } = mod.getContext(import.meta);

export class AdventuringAbilitiesElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-abilities-template'));

        this.container = getElementFromFragment(this._content, 'container', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
}
window.customElements.define('adventuring-abilities', AdventuringAbilitiesElement);