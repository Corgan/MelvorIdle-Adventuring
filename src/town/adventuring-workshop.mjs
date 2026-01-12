const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringWorkOrder } = await loadModule('src/town/adventuring-work-order.mjs');
const { formatRequirements } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

await loadModule('src/town/components/adventuring-workshop.mjs');
await loadModule('src/items/components/adventuring-stored-item.mjs');
await loadModule('src/town/components/adventuring-workshop-product.mjs');

const { AdventuringRequirementElement } = await loadModule('src/ui/components/adventuring-requirement.mjs');

class AdventuringWorkshopRenderQueue {
    constructor() {
        this.storedItems = false;
        this.workOrders = false;
        this.products = false;
    }
    queueAll() {
        this.storedItems = true;
        this.workOrders = true;
        this.products = true;
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

        this.products = []; // Initialize to empty array, populated in postDataRegistration
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

        this.selectedOutputType = 'item'; // 'item', 'material', 'consumable', 'conversion'
        this.selectedTier = 1;
        this.selectedProduct = undefined;

        this.renderQueue = new AdventuringWorkshopRenderQueue();

        this.component.back.onclick = () => this.back();
        this.component.submit.onclick = () => this.submitWorkOrder();

        this.component.tabItem.onclick = () => this.setOutputType('item');
        this.component.tabMaterial.onclick = () => this.setOutputType('material');
        this.component.tabConsumable.onclick = () => this.setOutputType('consumable');
        this.component.tabConversion.onclick = () => this.setOutputType('conversion');

        this.component.tierButtons.forEach((btn, i) => {
            btn.onclick = () => this.setTier(i + 1);
        });
    }

    setOutputType(type) {
        this.selectedOutputType = type;
        this.selectedProduct = undefined;

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

    setTier(tier) {
        const previousTier = this.selectedTier;
        this.selectedTier = tier;

        this.component.tierButtons.forEach((btn, i) => {
            const isActive = (i + 1) === tier;
            btn.classList.toggle('btn-info', isActive);
            btn.classList.toggle('btn-outline-info', !isActive);
            btn.classList.toggle('active', isActive);
        });

        if (this.selectedProduct && this.selectedProduct.hasTiers && this.selectedProduct.hasTier(tier)) {
            this.updateCostDisplay();
            this.updateRequirementsDisplay();

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

    store(output, count, outputType = 'item') {

        if (outputType !== 'item') {
            return;
        }

        let existingCount = this.storedItems.get(output);
        if(existingCount === undefined)
            existingCount = 0;

        this.storedItems.set(output, existingCount + count);
        this.renderQueue.storedItems = true;
    }

    shipToBank(output) {
        let count = this.storedItems.get(output);
        if(count !== undefined) {

            const success = this.game.bank.addItem(output, count, false, true);

            if(success) {
                this.storedItems.delete(output);
                this.renderQueue.storedItems = true;
            }
        }
    }

    collect(output) {
        this.shipToBank(output);
    }

    selectProduct(product) {
        this.selectedProduct = product;

        this.component.selectedProductDisplay.classList.remove('d-none');
        this.component.noProductSelected.classList.add('d-none');

        const tier = this.selectedTier;
        if (product.hasTiers) {
            this.component.selectedProductIcon.src = product.getMedia(tier);
            this.component.selectedProductName.textContent = product.getName(tier);
        } else {
            this.component.selectedProductIcon.src = product.media;
            this.component.selectedProductName.textContent = product.name;
        }

        this.component.count.value = 1;

        this.renderQueue.products = true;
        this.updateCostDisplay();
        this.updateRequirementsDisplay();
    }

    clearSelectedProduct() {
        this.selectedProduct = undefined;
        this.component.selectedProductDisplay.classList.add('d-none');
        this.component.noProductSelected.classList.remove('d-none');
        this.component.costDisplay.replaceChildren();
        this.component.requirementsDisplay.classList.add('d-none');
    }

    updateCostDisplay() {
        this.component.costDisplay.replaceChildren();

        if(!this.selectedProduct) {
            const placeholder = document.createElement('span');
            placeholder.className = 'text-muted small';
            placeholder.textContent = 'Select a product';
            this.component.costDisplay.appendChild(placeholder);
            return;
        }

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

            const component = document.createElement('adventuring-material');
            this.component.costDisplay.appendChild(component);
            component.icon.src = material.media;
            component.count.textContent = need;
            component.setTooltipContent(TooltipBuilder.forMaterial(material, this.manager).build());

            if (have >= need) {
                component.border.classList.remove('border-danger');
                component.border.classList.add('border-success');
            } else {
                component.border.classList.remove('border-success');
                component.border.classList.add('border-danger');
            }
        });
    }

    updateRequirementsDisplay() {
        const tier = this.selectedTier;
        const requirements = (this.selectedProduct && typeof this.selectedProduct.getRequirements === 'function')
            ? this.selectedProduct.getRequirements(tier)
            : [];

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

        for(const order of this.workOrders) {
            if(order.active && order.product.canMake(character, order.tier))
                return true;
        }
        return false;
    }

    doWork(character) {

        for(const order of this.workOrders) {
            if(order.active && order.product.canMake(character, order.tier)) {
                order.progress();
                return;
            }
        }
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.workOrders = true;
        this.renderQueue.products = true;
        this.renderQueue.storedItems = true;
        this.workOrders.forEach(order => {
            order.renderQueue.update = true;
        });

        this.setOutputType('item');
        this.setTier(1);
        this.clearSelectedProduct();
    }

    onShow() {
        this.manager.party.setAllLocked(false);
        this.clearSelectedProduct();
    }

    onHide() {
        this.manager.party.setAllLocked(true);
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

        this.component.productList.replaceChildren();

        const filteredProducts = this.products.filter(product => {
            if(this.selectedOutputType === 'item' && product.outputType !== 'item') return false;
            if(this.selectedOutputType === 'material' && product.outputType !== 'material') return false;
            if(this.selectedOutputType === 'consumable' && product.outputType !== 'consumable') return false;
            if(this.selectedOutputType === 'conversion' && product.outputType !== 'conversion') return false;
            return true;
        });

        const activeProducts = [...this.workOrders].filter(order => order.active).map(order => order.product);

        filteredProducts.forEach(product => {
            let productEl = this.productElements.get(product);
            if(productEl === undefined) {
                productEl = createElement('adventuring-workshop-product');
                this.productElements.set(product, productEl);
            }

            const tier = this.selectedTier;
            const isSelected = this.selectedProduct === product;
            const isActive = activeProducts.includes(product);
            const tooltip = this.getProductTooltip(product, tier);

            if (product.hasTiers) {
                productEl.setProduct({
                    iconSrc: product.getMedia(tier),
                    name: product.getName(tier),
                    selected: isSelected,
                    active: isActive,
                    tooltip: tooltip
                });
            } else {
                productEl.setProduct({
                    iconSrc: product.media,
                    name: product.name,
                    selected: isSelected,
                    active: isActive,
                    tooltip: tooltip
                });
            }

            productEl.clickable.onclick = () => this.selectProduct(product);

            this.component.productList.appendChild(productEl);
        });

        if(filteredProducts.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'text-muted text-center w-100 py-3';
            emptyMsg.textContent = 'No products available for this type';
            this.component.productList.appendChild(emptyMsg);
        }

        this.renderQueue.products = false;
    }

    getProductTooltip(product, tier) {
        const output = product.output;
        if(!output) return product.getName(tier);

        switch(product.outputType) {
            case 'consumable':
                return TooltipBuilder.forConsumableTier(output, tier).build();
            case 'material':
                return TooltipBuilder.forMaterial(output, this.manager).build();
            case 'conversion': {
                const tierData = product.getTierData(tier);
                if(tierData && tierData.outputMaterial) {
                    return TooltipBuilder.forMaterial(tierData.outputMaterial, this.manager).build();
                }
                return product.getName(tier);
            }
            case 'item':
            default: {
                const tooltip = TooltipBuilder.create()
                    .header(output.name, output.media);
                if(output.description) {
                    tooltip.hint(output.description);
                }
                return tooltip.build();
            }
        }
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
            const tooltip = TooltipBuilder.create()
                .header(item.name, item.media);
            if(item.description) {
                tooltip.hint(item.description);
            }
            component.setTooltipContent(tooltip.build());

            component.icon.src = item.media;
            component.clickable.onclick = () => this.shipToBank(item);

            component.count.textContent = this.storedItems.get(item);
            componentCount++;
        }

        const hasItems = this.storedItems.size > 0;
        this.component.storeEmpty.classList.toggle('d-none', hasItems);

        this.renderQueue.storedItems = false;
    }

    encode(writer) {

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