const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/components/adventuring-page.mjs');

export class AdventuringStashElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-stash-template');

        this.materials = getElementFromFragment(this._content, 'materials', 'div');
        this.categoryContainers = new Map();
    }

    /**
     * Get or create a category container
     */
    getCategoryContainer(categoryId, categoryName) {
        if (this.categoryContainers.has(categoryId)) {
            return this.categoryContainers.get(categoryId);
        }

        // Create category section
        const section = document.createElement('div');
        section.className = 'col-12 mb-3';
        section.id = `stash-category-${categoryId}`;
        
        section.innerHTML = `
            <div class="block block-rounded-double bg-combat-inner-dark">
                <div class="block-header block-header-default bg-dark-bank-block-header px-3 py-1">
                    <h5 class="font-size-sm font-w600 mb-0 text-warning">
                        <i class="fa fa-folder-open mr-1"></i>${categoryName}
                    </h5>
                    <div class="block-options">
                        <button type="button" class="btn btn-sm btn-outline-secondary" data-toggle="collapse" data-target="#stash-items-${categoryId}">
                            <i class="fa fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="collapse show" id="stash-items-${categoryId}">
                    <div class="block-content py-2">
                        <div class="row no-gutters stash-category-items"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.materials.appendChild(section);
        
        const itemsContainer = section.querySelector('.stash-category-items');
        this.categoryContainers.set(categoryId, itemsContainer);
        
        return itemsContainer;
    }

    /**
     * Clear all category containers (for reset)
     */
    clearCategories() {
        this.categoryContainers.clear();
        this.materials.innerHTML = '';
    }
}
window.customElements.define('adventuring-stash', AdventuringStashElement);