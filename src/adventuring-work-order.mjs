const { loadModule } = mod.getContext(import.meta);

const { AdventuringWorkOrderUIComponent } = await loadModule('src/components/adventuring-work-order.mjs');

class AdventuringWorkOrderRenderQueue {
    constructor() {
        this.update = false;
    }
}

export class AdventuringWorkOrder {
    constructor(manager, game, workshop) {
        this.manager = manager;
        this.game = game;
        this.workshop = workshop;

        this.component = new AdventuringWorkOrderUIComponent(this.manager, this.game, this);

        this.renderQueue = new AdventuringWorkOrderRenderQueue();

        this.product = undefined;
        this.count = 0;
        this.completed = 0;
        this.active = false;

        this.component.cancel.onclick = () => this.clear();
    }

    copy(order) {
        if(order.active) {
            this.active = true;
            this.product = order.product;
            this.completed = order.completed;
            this.count = order.count;
            this.renderQueue.update = true;
            order.clear();
        }
    }

    progress() {
        let { item, count } = this.product.create();
        this.workshop.store(item, count);

        this.completed += 1;
        this.renderQueue.update = true;
        if(this.completed >= this.count)
            this.clear();
    }

    submit(product, count) {
        this.product = product;
        this.count = count;
        this.completed = 0;
        this.active = true;
        this.renderQueue.update = true;
        this.workshop.renderQueue.products = true;
        this.workshop.renderQueue.workOrders = true;
    }

    clear() {
        this.active = false;
        this.product = undefined;
        this.completed = 0;
        this.count = 0;
        this.renderQueue.update = true;
        this.workshop.renderQueue.products = true;
        this.workshop.renderQueue.workOrders = true;
    }

    render() {
        if(!this.renderQueue.update)
            return;

        this.component.active.classList.toggle('d-none', !this.active)
        this.component.inactive.classList.toggle('d-none', this.active)
        if(this.active) {
            this.component.icon.src = this.product.media;
            this.component.name.textContent = this.product.name;
            this.component.completed.textContent = this.completed;
            this.component.count.textContent = this.count;
        }

        this.renderQueue.update = false;
    }

    encode(writer) {
        writer.writeBoolean(this.active);
        if(this.active) {
            writer.writeNamespacedObject(this.product);
            writer.writeUint32(this.count);
            writer.writeUint32(this.completed);
        }
    }

    decode(reader, version) {
        this.active = reader.getBoolean();
        if(this.active) {
            this.product = reader.getNamespacedObject(this.manager.products);
            this.count = reader.getUint32();
            this.completed = reader.getUint32();
        }
    }
}