const { loadModule } = mod.getContext(import.meta);

export class AdventuringJobsElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-jobs-template'));

        this.container = getElementFromFragment(this._content, 'container', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    show() {
        showElement(this);
    }

    hide() {
        hideElement(this);
    }
}
window.customElements.define('adventuring-jobs', AdventuringJobsElement);