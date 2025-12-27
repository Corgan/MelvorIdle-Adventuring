const { loadModule } = mod.getContext(import.meta);

const { AdventuringWorkOrderElement } = await loadModule('src/town/components/adventuring-work-order.mjs');

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

        this.component = createElement('adventuring-work-order');

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
        let { output, outputType, count } = this.product.create();
        this.workshop.store(output, count, outputType);

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

    /**
     * Get which party members can work on this order
     */
    getCraftableByText() {
        if(!this.product) return '';
        
        const canWork = this.manager.party.all.filter(member => 
            this.product.canMake(member)
        );
        
        if(canWork.length === 0) {
            return '<span class="text-warning">⚠ No party member can craft this</span>';
        }
        
        const names = canWork.map(m => m.name).join(', ');
        return `<span class="text-success">✓ Can be crafted by: ${names}</span>`;
    }

    render() {
        if(!this.renderQueue.update)
            return;

        this.component.active.classList.toggle('d-none', !this.active)
        this.component.inactive.classList.toggle('d-none', this.active)
        if(this.active) {
            this.component.icon.src = this.product.media;
            this.component.nameText.textContent = this.product.name;
            this.component.progressText.textContent = `${this.completed} / ${this.count} completed`;
            
            // Update progress bar
            const percent = this.count > 0 ? (this.completed / this.count) * 100 : 0;
            this.component.progressBar.style.width = `${percent}%`;
            
            // Show who can craft this
            this.component.craftableBy.innerHTML = this.getCraftableByText();
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