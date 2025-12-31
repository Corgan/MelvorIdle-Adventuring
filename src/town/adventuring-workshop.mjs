const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringWorkOrder } = await loadModule('src/town/adventuring-work-order.mjs');
const { formatRequirements } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringWorkshopElement } = await loadModule('src/town/components/adventuring-workshop.mjs');
const { AdventuringStoredItemElement } = await loadModule('src/items/components/adventuring-stored-item.mjs');
const { AdventuringMaterialCostElement } = await loadModule('src/ui/components/adventuring-material-cost.mjs');
const { AdventuringRequirementElement } = await loadModule('src/ui/components/adventuring-requirement.mjs');
const { AdventuringDropdownOptionElement } = await loadModule('src/ui/components/adventuring-dropdown-option.mjs');

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
        this.dropdownOptions = new Map();

        this.renderQueue = new AdventuringWorkshopRenderQueue();

        this.component.back.onclick = () => this.back();
        this.component.submit.onclick = () => this.submitWorkOrder();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    store(output, count, outputType = 'item') {
        let existingCount = this.storedItems.get(output);
        if(existingCount === undefined)
            existingCount = 0;
        
        this.storedItems.set(output, existingCount + count);
        // Track output type for collection routing
        if(!this.storedOutputTypes) this.storedOutputTypes = new Map();
        this.storedOutputTypes.set(output, outputType);
        this.renderQueue.storedItems = true;
    }
    
    collect(output) {
        let count = this.storedItems.get(output);
        if(count !== undefined) {
            const outputType = this.storedOutputTypes?.get(output) || 'item';
            let success = false;
            
            switch(outputType) {
                case 'material':
                    // Materials go to adventuring stash
                    this.manager.stash.add(output, count);
                    success = true;
                    break;
                case 'consumable':
                    // Consumables go to adventuring stash (they're materials internally)
                    this.manager.stash.add(output, count);
                    success = true;
                    break;
                case 'item':
                default:
                    // Items go to the bank
                    success = this.game.bank.addItem(output, count, false, true);
                    break;
            }
            
            if(success) {
                this.storedItems.delete(output);
                this.storedOutputTypes?.delete(output);
                this.renderQueue.storedItems = true;
            }
        }
    }

    selectProduct(product) {
        this.component.productButton.textContent = product.name;
        this.selectedProduct = product;
        this.renderQueue.products = true;
        this.updateCostDisplay();
        this.updateRequirementsDisplay();
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

        if(!this.selectedProduct.materials || this.selectedProduct.materials.length === 0) {
            const free = document.createElement('span');
            free.className = 'text-success small';
            free.textContent = 'No materials required';
            this.component.costDisplay.appendChild(free);
            return;
        }

        this.selectedProduct.materials.forEach(mat => {
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
        if(!this.selectedProduct || !this.selectedProduct.requirements || this.selectedProduct.requirements.length === 0) {
            this.component.requirementsDisplay.classList.add('d-none');
            return;
        }

        const formatted = formatRequirements(this.selectedProduct.requirements, this.manager);
        
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
        
        let orders = [...this.workOrders.values()];
        for(let order of orders) {
            if(order.active)
                continue;
            order.submit(product, count);
            break;
        }

        this.selectedProduct = undefined;
        this.component.count.value = 0;

        this.renderQueue.products = true;
    }

    hasWorkOrders(character) {
        return [...this.workOrders].filter(order => order.active && order.product.canMake(character)).length > 0;
    }

    doWork(character) {
        let order = [...this.workOrders].find(order => order.active && order.product.canMake(character))
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
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
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

        let existing = [...this.workOrders.keys()].filter(order => order.active).map(order => order.product);
        this.component.productRecipeOptions.textContent = '';
        this.products.forEach(product => {
            let productContainer = this.dropdownOptions.get(product);
            if(productContainer === undefined) {
                productContainer = new AdventuringDropdownOptionElement();
                this.dropdownOptions.set(product, productContainer);
            }
            this.component.productRecipeOptions.appendChild(productContainer);
            productContainer.setFromItem(product, () => this.selectProduct(product));
        });
        if(this.selectedProduct === undefined)
            this.component.productButton.textContent = 'Select Product';

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
            component.clickable.onclick = () => this.collect(item);
    
            component.count.textContent = this.storedItems.get(item);
            componentCount++;
        }

        // Show/hide empty state
        const hasItems = this.storedItems.size > 0;
        this.component.storeEmpty.classList.toggle('d-none', hasItems);

        this.renderQueue.storedItems = false;
    }

    encode(writer) {
        // Encode stored items with their output types
        const itemEntries = [];
        const materialEntries = [];
        const consumableEntries = [];
        
        this.storedItems.forEach((count, output) => {
            const outputType = this.storedOutputTypes?.get(output) || 'item';
            if(outputType === 'material') {
                materialEntries.push({ output, count });
            } else if(outputType === 'consumable') {
                consumableEntries.push({ output, count });
            } else {
                itemEntries.push({ output, count });
            }
        });
        
        // Write items (from game.items)
        writer.writeUint32(itemEntries.length);
        for(const entry of itemEntries) {
            writer.writeNamespacedObject(entry.output);
            writer.writeUint32(entry.count);
        }
        
        // Write materials
        writer.writeUint32(materialEntries.length);
        for(const entry of materialEntries) {
            writer.writeNamespacedObject(entry.output);
            writer.writeUint32(entry.count);
        }
        
        // Write consumables
        writer.writeUint32(consumableEntries.length);
        for(const entry of consumableEntries) {
            writer.writeNamespacedObject(entry.output);
            writer.writeUint32(entry.count);
        }
        
        writer.writeSet(this.workOrders, (order, writer) => {
            order.encode(writer);
        });
    }

    decode(reader, version) {
        if(!this.storedOutputTypes) this.storedOutputTypes = new Map();
        
        // Read items
        const itemCount = reader.getUint32();
        for(let i = 0; i < itemCount; i++) {
            let key = reader.getNamespacedObject(this.game.items);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.storedItems.set(key, value);
                this.storedOutputTypes.set(key, 'item');
            }
        }
        
        // Read materials
        const materialCount = reader.getUint32();
        for(let i = 0; i < materialCount; i++) {
            let key = reader.getNamespacedObject(this.manager.materials);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.storedItems.set(key, value);
                this.storedOutputTypes.set(key, 'material');
            }
        }
        
        // Read consumables
        const consumableCount = reader.getUint32();
        for(let i = 0; i < consumableCount; i++) {
            let key = reader.getNamespacedObject(this.manager.consumableTypes);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.storedItems.set(key, value);
                this.storedOutputTypes.set(key, 'consumable');
            }
        }
        
        let workOrders = this.workOrders.values();
        reader.getSet((reader) => {
            let order = workOrders.next().value;
            order.decode(reader, version);
        });
    }
}