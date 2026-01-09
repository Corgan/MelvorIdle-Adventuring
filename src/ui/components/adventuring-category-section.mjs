/**
 * Category section with header and content container
 */
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

    /**
     * Set the section header and optional content
     * @param {Object} options
     * @param {string} options.title - Section header text
     * @param {string} [options.headerClass] - Optional additional class for header
     */
    setSection({ title, headerClass }) {
        this.header.textContent = title;
        if(headerClass) {
            this.header.className = `font-w600 text-muted mb-2 border-bottom border-dark pb-1 ${headerClass}`;
        }
    }

    /**
     * Get the content container for appending children
     * @returns {HTMLElement}
     */
    getContent() {
        return this.content;
    }

    /**
     * Clear the content container
     */
    clearContent() {
        this.content.replaceChildren();
    }
}
window.customElements.define('adventuring-category-section', AdventuringCategorySectionElement);
