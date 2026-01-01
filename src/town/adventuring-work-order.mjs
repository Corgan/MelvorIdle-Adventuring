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
        this.tier = 1; // Track selected tier for tiered products
        this.count = 0;
        this.completed = 0;
        this.active = false;

        this.component.cancel.onclick = () => this.clear();
    }

    copy(order) {
        if(order.active) {
            this.active = true;
            this.product = order.product;
            this.tier = order.tier;
            this.completed = order.completed;
            this.count = order.count;
            this.renderQueue.update = true;
            order.clear();
        }
    }

    progress() {
        let { output, outputType, count } = this.product.create(this.tier);
        this.workshop.store(output, count, outputType);

        this.completed += 1;
        this.renderQueue.update = true;
        if(this.completed >= this.count)
            this.clear();
    }

    submit(product, count, tier = 1) {
        this.product = product;
        this.tier = tier;
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
        this.tier = 1;
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
            this.product.canMake(member, this.tier)
        );
        
        if(canWork.length === 0) {
            return '<span class="text-warning"><i class="fas fa-exclamation-triangle mr-1"></i>No party member can craft this</span>';
        }
        
        const names = canWork.map(m => m.name).join(', ');
        return `<span class="text-success"><i class="fas fa-check mr-1"></i>Can be crafted by: ${names}</span>`;
    }

    render() {
        if(!this.renderQueue.update)
            return;

        this.component.active.classList.toggle('d-none', !this.active)
        this.component.inactive.classList.toggle('d-none', this.active)
        if(this.active) {
            // Use tier-aware methods for consumables
            if (this.product.outputType === 'consumable' && this.product.hasTiers) {
                this.component.icon.src = this.product.getMedia(this.tier);
                this.component.nameText.textContent = this.product.getName(this.tier);
            } else {
                this.component.icon.src = this.product.media;
                this.component.nameText.textContent = this.product.name;
            }
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
            writer.writeUint32(this.tier);
            writer.writeUint32(this.count);
            writer.writeUint32(this.completed);
        }
    }

    decode(reader, version) {
        this.active = reader.getBoolean();
        if(this.active) {
            this.product = reader.getNamespacedObject(this.manager.products);
            this.tier = reader.getUint32();
            this.count = reader.getUint32();
            this.completed = reader.getUint32();
        }
    }
}