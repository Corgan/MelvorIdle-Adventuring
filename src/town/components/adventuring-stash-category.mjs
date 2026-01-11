
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

    setCategory(id, name) {
        this.section.id = `stash-category-${id}`;
        this.categoryNameText.textContent = name;
    }

    getItemsContainer() {
        return this.items;
    }

    clearItems() {
        this.items.replaceChildren();
    }
}
window.customElements.define('adventuring-stash-category', AdventuringStashCategoryElement);
