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

    /**
     * Get or create a category container
     */
    getCategoryContainer(categoryId, categoryName) {
        if (this.categoryContainers.has(categoryId)) {
            return this.categoryContainers.get(categoryId);
        }

        // Create category section using custom element
        const category = new AdventuringStashCategoryElement();
        this.materials.appendChild(category);
        category.setCategory(categoryId, categoryName);
        
        const itemsContainer = category.getItemsContainer();
        this.categoryContainers.set(categoryId, itemsContainer);
        this.categoryElements.set(categoryId, category);
        
        return itemsContainer;
    }

    /**
     * Clear all category containers (for reset)
     */
    clearCategories() {
        this.categoryContainers.clear();
        this.categoryElements.clear();
        this.materials.replaceChildren();
    }
}
window.customElements.define('adventuring-stash', AdventuringStashElement);