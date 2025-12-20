const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringWorkOrder } = await loadModule('src/adventuring-work-order.mjs');

const { AdventuringWorkshopElement } = await loadModule('src/components/adventuring-workshop.mjs');
const { AdventuringStoredItemElement } = await loadModule('src/components/adventuring-stored-item.mjs');

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
        this.component.name.textContent = data.name;
        
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

    store(item, count) {
        let existingCount = this.storedItems.get(item);
        if(existingCount === undefined)
            existingCount = 0;
        
        this.storedItems.set(item, existingCount + count);
        this.renderQueue.storedItems = true;
    }
    
    collect(item) {
        let count = this.storedItems.get(item);
        if(count !== undefined) {
            if (this.game.bank.addItem(item, count, false, true)) {
                this.storedItems.delete(item);
                this.renderQueue.storedItems = true;
            }
        }
    }

    selectProduct(product) {
        this.component.productButton.textContent = product.name;
        this.selectedProduct = product;
        this.renderQueue.products = true;
    }

    submitWorkOrder() {
        let product = this.selectedProduct;
        if(product === undefined)
            return;
        let count = parseInt(this.component.count.value);
        if(count === 0)
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
        if(this._products !== undefined)
            this.products = this._products.map(id => this.manager.products.getObjectByID(id));
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
                productContainer = createElement('div', {
                    classList: ['row', 'gutters-tiny'],
                    parent: this.component.productRecipeOptions,
                    children: [createElement('img', { classList: ['skill-icon-xs'] }), createElement('span', { classList: ['col'] })]
                });
                productContainer.onclick = () => this.selectProduct(product);
                this.dropdownOptions.set(product, productContainer);
            }
            let [ icon, name ] = productContainer.children;
            icon.src = product.media;
            name.textContent = product.name;
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
            component.unmount();
        });

        let componentCount = 0;
        for(let item of this.storedItems.keys()) {
            let component = this.itemComponents[componentCount];
            if(component === undefined) {
                component = createElement('adventuring-stored-item');
                this.itemComponents[componentCount] = component;
            }

            component.mount(this.component.store);
            component.tooltip.setContent(item.name);
    
            component.icon.src = item.media;
            component.clickable.onclick = () => this.collect(item);
    
            component.count.textContent = this.storedItems.get(item);
            componentCount++;
        }


        this.renderQueue.storedItems = false;
    }

    encode(writer) {
        writer.writeComplexMap(this.storedItems, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint32(value);
        });
        writer.writeSet(this.workOrders, (order, writer) => {
            order.encode(writer);
        });
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.game.items);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.storedItems.set(key, value);
            }
        });
        let workOrders = this.workOrders.values();
        reader.getSet((reader) => {
            let order = workOrders.next().value;
            order.decode(reader, version);
        });
    }
}