/**
 * Stash category section element - container for material items in a category
 */
export class AdventuringStashCategoryElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stash-category-template'));
        
        this.section = getElementFromFragment(this._content, 'section', 'div');
        this.categoryNameText = getElementFromFragment(this._content, 'categoryName', 'span');
        this.items = getElementFromFragment(this._content, 'items', 'div');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the category info
     * @param {string} id - Category ID for element identification
     * @param {string} name - Display name for the category
     */
    setCategory(id, name) {
        this.section.id = `stash-category-${id}`;
        this.categoryNameText.textContent = name;
    }

    /**
     * Get the items container for adding material components
     * @returns {HTMLElement}
     */
    getItemsContainer() {
        return this.items;
    }

    /**
     * Clear all items from this category
     */
    clearItems() {
        this.items.replaceChildren();
    }
}
window.customElements.define('adventuring-stash-category', AdventuringStashCategoryElement);
