const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

const { AdventuringAuraUIComponent } = await loadModule('src/components/adventuring-aura.mjs');

class AdventuringAuraRenderQueue {
    constructor() {
        this.name = false;
        this.description = false;
        this.highlight = false;
        this.descriptionCharacter = false;
    }

    queueAll() {
        this.name = true;
        this.description = true;
        this.highlight = true;
    }
}

class AdventuringAuraEffect {
    constructor(manager, game, aura, data) {
        this.manager = manager;
        this.game = game;
        this.aura = aura;
        this.type = data.type;
        this.trigger = data.trigger;
        this.consume = data.consume === true; // Remove stacks by amount
        this.stack = data.stack === true; // Amount multiplied by stack count
        this.split = data.split === true; // Amount divided by stack count

        if(data.target !== undefined)
            this.target = data.target;
        if(data.id !== undefined) 
            this.id = data.id;
        if(data.count !== undefined) 
            this.count = data.count;
    }

    postDataRegistration() {
        
    }

    getAmount(instance) {
        let min = this.aura.amount !== undefined ? this.aura.amount : 1;
        let amount = min;

        if(instance.amount !== undefined) {
            amount = instance.amount;
        }

        if(this.stack)
            amount = Math.floor(amount * instance.stacks);

        if(this.split) {
            amount = Math.ceil(amount / instance.stacks);
            if(instance.amount !== undefined)
                instance.amount = Math.max(min * instance.stacks, instance.amount - amount);
        }

        return amount;
    }
}

export class AdventuringAura extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this._media = data.media;
        this.name = data.name;
        this.description = data.description;
        this.effects = data.effects.map(effect => new AdventuringAuraEffect(this.manager, this.game, this, effect));

        this.combine = data.combine === true; // No Source Filter

        this.stack = data.stack === true; // Add stacks when applying
        this.refresh = data.refresh === true; // Set stacks when applying

        this.accumulate = data.accumulate === true; // Add Amount when applying
        this.overwrite = data.overwrite === true; // Set Amount when applying
        
        if(data.amount !== undefined)
            this.amount = data.amount;
        
        if(data.stacks !== undefined)
            this.stacks = data.stacks;

        this.highlight = false;

        this.renderQueue = new AdventuringAuraRenderQueue();
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    onLoad() {
        
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }

    getDescription(instance) {
        return this.effects.reduce((desc, effect, i) => desc.replace(`{effect.${i}.amount}`, effect.getAmount(instance)), this.description);
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
    }

    render() {
        this.renderName();
        this.renderDescription();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.name.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderDescription() {
        if(!this.renderQueue.description)
            return;
        
        this.component.description.innerHTML = this.getDescription();

        this.renderQueue.description = false;
    }
}