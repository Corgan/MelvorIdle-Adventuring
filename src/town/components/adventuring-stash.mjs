const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');
const { AdventuringStashCategoryElement } = await loadModule('src/town/components/adventuring-stash-category.mjs');

export class AdventuringStashElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-stash-template');

        this.materials = getElementFromFragment(this._content, 'materials', 'div');
        this.categoryContainers = new Map();
        this.categoryElements = new Map();
    }

    getCategoryContainer(categoryId, categoryName) {
        if (this.categoryContainers.has(categoryId)) {
            return this.categoryContainers.get(categoryId);
        }
        const category = new AdventuringStashCategoryElement();
        this.materials.appendChild(category);
        category.setCategory(categoryId, categoryName);

        const itemsContainer = category.getItemsContainer();
        this.categoryContainers.set(categoryId, itemsContainer);
        this.categoryElements.set(categoryId, category);

        return itemsContainer;
    }

    clearCategories() {
        this.categoryContainers.clear();
        this.categoryElements.clear();
        this.materials.replaceChildren();
    }
}
window.customElements.define('adventuring-stash', AdventuringStashElement);