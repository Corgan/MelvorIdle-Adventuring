
export class AdventuringCategorySectionElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-category-section-template'));

        this.section = getElementFromFragment(this._content, 'section', 'div');
        this.header = getElementFromFragment(this._content, 'header', 'h6');
        this.content = getElementFromFragment(this._content, 'content', 'div');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setSection({ title, headerClass }) {
        this.header.textContent = title;
        if(headerClass) {
            this.header.className = `font-w600 text-muted mb-2 border-bottom border-dark pb-1 ${headerClass}`;
        }
    }

    getContent() {
        return this.content;
    }

    clearContent() {
        this.content.replaceChildren();
    }
}
window.customElements.define('adventuring-category-section', AdventuringCategorySectionElement);
