export class AdventuringSubpageElement extends HTMLElement {
    constructor(template) {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode(template));

        this.page = getElementFromFragment(this._content, 'page', 'div');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    mount(parent) {
        parent.append(this);
    }

    show() {
        showElement(this.page);
    }

    hide() {
        hideElement(this.page);
    }
}