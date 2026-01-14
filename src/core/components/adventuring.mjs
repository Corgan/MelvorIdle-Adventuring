export class AdventuringPageElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-page-template'));

        this.container = getElementFromFragment(this._content, 'adventuring-content', 'div');
        this.party = getElementFromFragment(this._content, 'party', 'div');
        this.overview = getElementFromFragment(this._content, 'overview', 'div');
        this.subpages = getElementFromFragment(this._content, 'subpages', 'div');
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.id = 'adventuring-container';
        this.classList.add('d-none');
        this.appendChild(this._content);
    }

    show() {
        showElement(this.container);
    }

    hide() {
        hideElement(this.container);
    }
}
window.customElements.define('adventuring-page', AdventuringPageElement);