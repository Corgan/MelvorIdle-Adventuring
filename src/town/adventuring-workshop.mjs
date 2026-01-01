const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringWorkOrder } = await loadModule('src/town/adventuring-work-order.mjs');
const { formatRequirements } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringWorkshopElement } = await loadModule('src/town/components/adventuring-workshop.mjs');
const { AdventuringStoredItemElement } = await loadModule('src/items/components/adventuring-stored-item.mjs');
const { AdventuringMaterialCostElement } = await loadModule('src/ui/components/adventuring-material-cost.mjs');
const { AdventuringRequirementElement } = await loadModule('src/ui/components/adventuring-requirement.mjs');
const { AdventuringWorkshopProductElement } = await loadModule('src/town/components/adventuring-workshop-product.mjs');

class AdventuringWorkshopRenderQueue {
    constructor() {
        this.storedItems = false;
        this.workOrders = false;
        this.products = false;
    }
}

export class AdventuringWorkshop extends AdventuringPage {
    constructor(manager, game, data, building) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.building = building;
        
        this.component = createElement('adventuring-workshop');
        this.component.nameText.textContent = data.name;
        
        if(data.products !== undefined)
            this._products = data.products;

        this.workOrders = new Set();
        for(let i=1; i<=3; i++) {
            let order = new AdventuringWorkOrder(this.manager, this.game, this);
            this.workOrders.add(order);
            order.component.mount(this.component.orders);
        }
        this.storedItems = new Map();
        this.itemComponents = [];
        this.productElements = new Map();

        // UI state for product selection
        this.selectedOutputType = 'item'; // 'item', 'material', 'consumable', 'conversion'
        this.selectedTier = 1;
        this.selectedProduct = undefined;

        this.renderQueue = new AdventuringWorkshopRenderQueue();

        this.component.back.onclick = () => this.back();
        this.component.submit.onclick = () => this.submitWorkOrder();
        
        // Set up output type tab handlers
        this.component.tabItem.onclick = () => this.setOutputType('item');
        this.component.tabMaterial.onclick = () => this.setOutputType('material');
        this.component.tabConsumable.onclick = () => this.setOutputType('consumable');
        this.component.tabConversion.onclick = () => this.setOutputType('conversion');
        
        // Set up tier button handlers
        this.component.tierButtons.forEach((btn, i) => {
            btn.onclick = () => this.setTier(i + 1);
        });
    }

    /**
     * Set the selected output type and update UI
     */
    setOutputType(type) {
        this.selectedOutputType = type;
        this.selectedProduct = undefined;
        
        // Update tab button states
        this.component.tabItem.classList.toggle('btn-info', type === 'item');
        this.component.tabItem.classList.toggle('btn-outline-info', type !== 'item');
        this.component.tabItem.classList.toggle('active', type === 'item');
        
        this.component.tabMaterial.classList.toggle('btn-info', type === 'material');
        this.component.tabMaterial.classList.toggle('btn-outline-info', type !== 'material');
        this.component.tabMaterial.classList.toggle('active', type === 'material');
        
        this.component.tabConsumable.classList.toggle('btn-info', type === 'consumable');
        this.component.tabConsumable.classList.toggle('btn-outline-info', type !== 'consumable');
        this.component.tabConsumable.classList.toggle('active', type === 'consumable');
        
        this.component.tabConversion.classList.toggle('btn-info', type === 'conversion');
        this.component.tabConversion.classList.toggle('btn-outline-info', type !== 'conversion');
        this.component.tabConversion.classList.toggle('active', type === 'conversion');
        
        this.renderQueue.products = true;
        this.render();
    }

    /**
     * Set the selected tier and update UI
     */
    setTier(tier) {
        const previousTier = this.selectedTier;
        this.selectedTier = tier;
        
        // Update tier button states
        this.component.tierButtons.forEach((btn, i) => {
            const isActive = (i + 1) === tier;
            btn.classList.toggle('btn-info', isActive);
            btn.classList.toggle('btn-outline-info', !isActive);
            btn.classList.toggle('active', isActive);
        });
        
        // If we had a product selected, keep it selected (it's the same product, just different tier)
        // Update the cost display to reflect the new tier
        if (this.selectedProduct && this.selectedProduct.hasTiers && this.selectedProduct.hasTier(tier)) {
            this.updateCostDisplay();
            this.updateRequirementsDisplay();
            // Update the selected product display with new tier info
            this.component.selectedProductIcon.src = this.selectedProduct.getMedia(tier);
            this.component.selectedProductName.textContent = this.selectedProduct.getName(tier);
        }
        
        this.renderQueue.products = true;
        this.render();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    /**
     * Store an item for later collection (shipping to bank)
     * Only used for Melvor item outputs - materials/consumables/conversions are added directly
     */
    store(output, count, outputType = 'item') {
        // Only store items (Melvor materials) - everything else is added directly in product.create()
        if (outputType !== 'item') {
            return;
        }
        
        let existingCount = this.storedItems.get(output);
        if(existingCount === undefined)
            existingCount = 0;
        
        this.storedItems.set(output, existingCount + count);
        this.renderQueue.storedItems = true;
    }
    
    /**
     * Ship stored items to the player's bank
     */
    shipToBank(output) {
        let count = this.storedItems.get(output);
        if(count !== undefined) {
            // Items go to the bank
            const success = this.game.bank.addItem(output, count, false, true);
            
            if(success) {
                this.storedItems.delete(output);
                this.renderQueue.storedItems = true;
            }
        }
    }
    
    // Keep collect as an alias for backwards compatibility
    collect(output) {
        this.shipToBank(output);
    }

    selectProduct(product) {
        this.selectedProduct = product;
        
        // Show selected product display
        this.component.selectedProductDisplay.classList.remove('d-none');
        this.component.noProductSelected.classList.add('d-none');
        
        // Update product info based on current tier
        const tier = this.selectedTier;
        if (product.hasTiers) {
            this.component.selectedProductIcon.src = product.getMedia(tier);
            this.component.selectedProductName.textContent = product.getName(tier);
        } else {
            this.component.selectedProductIcon.src = product.media;
            this.component.selectedProductName.textContent = product.name;
        }
        
        // Reset count to 1
        this.component.count.value = 1;
        
        this.renderQueue.products = true;
        this.updateCostDisplay();
        this.updateRequirementsDisplay();
    }

    /**
     * Clear the selected product
     */
    clearSelectedProduct() {
        this.selectedProduct = undefined;
        this.component.selectedProductDisplay.classList.add('d-none');
        this.component.noProductSelected.classList.remove('d-none');
        this.component.costDisplay.replaceChildren();
        this.component.requirementsDisplay.classList.add('d-none');
    }

    /**
     * Update the cost display for the selected product
     */
    updateCostDisplay() {
        this.component.costDisplay.replaceChildren();
        
        if(!this.selectedProduct) {
            const placeholder = document.createElement('span');
            placeholder.className = 'text-muted small';
            placeholder.textContent = 'Select a product';
            this.component.costDisplay.appendChild(placeholder);
            return;
        }

        // Get materials for the current tier
        const tier = this.selectedTier;
        const materials = this.selectedProduct.getMaterials(tier);

        if(!materials || materials.length === 0) {
            const free = document.createElement('span');
            free.className = 'text-success small';
            free.textContent = 'No materials required';
            this.component.costDisplay.appendChild(free);
            return;
        }

        materials.forEach(mat => {
            const material = this.manager.materials.getObjectByID(mat.id);
            if(!material) return;
            
            const have = this.manager.stash.getCount(material);
            const need = mat.count;
            
            const costEl = new AdventuringMaterialCostElement();
            costEl.setCost({ iconSrc: material.media, have, need });
            this.component.costDisplay.appendChild(costEl);
        });
    }

    /**
     * Update the requirements display for the selected product
     */
    updateRequirementsDisplay() {
        const tier = this.selectedTier;
        const requirements = this.selectedProduct?.getRequirements(tier) || [];
        
        if(!this.selectedProduct || requirements.length === 0) {
            this.component.requirementsDisplay.classList.add('d-none');
            return;
        }

        const formatted = formatRequirements(requirements, this.manager);
        
        if(formatted.length > 0) {
            this.component.requirementsDisplay.replaceChildren();
            formatted.forEach((req, i) => {
                if(i > 0) {
                    const separator = document.createElement('span');
                    separator.textContent = ' • ';
                    this.component.requirementsDisplay.appendChild(separator);
                }
                const reqEl = new AdventuringRequirementElement();
                reqEl.setRequirement({ text: req.text, met: req.met, showIcon: false });
                this.component.requirementsDisplay.appendChild(reqEl);
            });
            this.component.requirementsDisplay.classList.remove('d-none');
        } else {
            this.component.requirementsDisplay.classList.add('d-none');
        }
    }

    submitWorkOrder() {
        let product = this.selectedProduct;
        if(product === undefined)
            return;
        let count = parseInt(this.component.count.value);
        if(count === 0 || count < 1)
            return;
        
        // Pass the selected tier to the work order
        const tier = this.selectedTier;
        
        let orders = [...this.workOrders.values()];
        for(let order of orders) {
            if(order.active)
                continue;
            order.submit(product, count, tier);
            break;
        }

        this.clearSelectedProduct();
        this.component.count.value = 1;

        this.renderQueue.products = true;
        this.render();
    }

    hasWorkOrders(character) {
        return [...this.workOrders].filter(order => order.active && order.product.canMake(character, order.tier)).length > 0;
    }

    doWork(character) {
        let order = [...this.workOrders].find(order => order.active && order.product.canMake(character, order.tier))
        if(order !== undefined)
            order.progress();
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.workOrders = true;
        this.renderQueue.products = true;
        this.renderQueue.storedItems = true;
        this.workOrders.forEach(order => {
            order.renderQueue.update = true;
        });
        
        // Reset UI state
        this.setOutputType('item');
        this.setTier(1);
        this.clearSelectedProduct();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
        this.clearSelectedProduct();
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    postDataRegistration() {
        if(this._products !== undefined) {
            this.products = this._products.map(id => {
                const product = this.manager.products.getObjectByID(id);
                if(product === undefined)
                    console.warn(`[Adventuring] Workshop "${this.name}" references missing product: ${id}`);
                return product;
            }).filter(p => p !== undefined);
        }
    }


    render() {
        this.renderStoredItems();
        this.renderProducts();
        this.renderWorkOrders();
        this.workOrders.forEach(order => order.render());
    }

    renderProducts() {
        if(!this.renderQueue.products)
            return;

        // Clear product list
        this.component.productList.replaceChildren();
        
        // Filter products by output type
        // For consumables with tiers, show all consumable products (tier selection is separate)
        const filteredProducts = this.products.filter(product => {
            if(this.selectedOutputType === 'item' && product.outputType !== 'item') return false;
            if(this.selectedOutputType === 'material' && product.outputType !== 'material') return false;
            if(this.selectedOutputType === 'consumable' && product.outputType !== 'consumable') return false;
            if(this.selectedOutputType === 'conversion' && product.outputType !== 'conversion') return false;
            return true;
        });
        
        // Get active orders to show which products are in use
        const activeProducts = [...this.workOrders].filter(order => order.active).map(order => order.product);
        
        // Render filtered products using AdventuringWorkshopProductElement
        filteredProducts.forEach(product => {
            let productEl = this.productElements.get(product);
            if(productEl === undefined) {
                productEl = createElement('adventuring-workshop-product');
                this.productElements.set(product, productEl);
            }
            
            // Get display info based on tier for tiered products
            const tier = this.selectedTier;
            const isSelected = this.selectedProduct === product;
            const isActive = activeProducts.includes(product);
            
            if (product.hasTiers) {
                productEl.setProduct({
                    iconSrc: product.getMedia(tier),
                    name: product.getName(tier),
                    selected: isSelected,
                    active: isActive
                });
            } else {
                productEl.setProduct({
                    iconSrc: product.media,
                    name: product.name,
                    selected: isSelected,
                    active: isActive
                });
            }
            
            productEl.clickable.onclick = () => this.selectProduct(product);
            
            this.component.productList.appendChild(productEl);
        });
        
        // Show empty state if no products
        if(filteredProducts.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-muted text-center w-100 py-3';
            emptyMsg.textContent = 'No products available for this type';
            this.component.productList.appendChild(emptyMsg);
        }

        this.renderQueue.products = false;
    }

    renderWorkOrders() {
        if(!this.renderQueue.workOrders)
            return;

        let orders = [...this.workOrders];

        for(let i=0; i<orders.length; i++) {
            let order = orders[i];
            if(order.active === false) {
                for(let j=i+1; j<orders.length; j++) {
                    if(orders[j].active === true) {
                        order.copy(orders[j]);
                        break;
                    }
                }
            }
        }

        this.renderQueue.workOrders = false;
    }

    renderStoredItems() {
        if(!this.renderQueue.storedItems)
            return;

        this.itemComponents.forEach(component => {
            component.remove();
        });

        let componentCount = 0;
        for(let item of this.storedItems.keys()) {
            let component = this.itemComponents[componentCount];
            if(component === undefined) {
                component = createElement('adventuring-stored-item');
                this.itemComponents[componentCount] = component;
            }

            component.mount(this.component.store);
            component.setTooltipContent(item.name);
    
            component.icon.src = item.media;
            component.clickable.onclick = () => this.shipToBank(item);
    
            component.count.textContent = this.storedItems.get(item);
            componentCount++;
        }

        // Show/hide empty state
        const hasItems = this.storedItems.size > 0;
        this.component.storeEmpty.classList.toggle('d-none', hasItems);

        this.renderQueue.storedItems = false;
    }

    encode(writer) {
        // Only items are stored now (materials/consumables/conversions added directly)
        writer.writeUint32(this.storedItems.size);
        this.storedItems.forEach((count, item) => {
            writer.writeNamespacedObject(item);
            writer.writeUint32(count);
        });
        
        writer.writeSet(this.workOrders, (order, writer) => {
            order.encode(writer);
        });
    }

    decode(reader, version) {
        // Read items
        const itemCount = reader.getUint32();
        for(let i = 0; i < itemCount; i++) {
            let key = reader.getNamespacedObject(this.game.items);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.storedItems.set(key, value);
            }
        }
        
        let workOrders = this.workOrders.values();
        reader.getSet((reader) => {
            let order = workOrders.next().value;
            order.decode(reader, version);
        });
    }
}