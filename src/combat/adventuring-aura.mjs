const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { parseDescription, buildEffectReplacements, describeEffectFull } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringAuraElement } = await loadModule('src/combat/components/adventuring-aura.mjs');

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
        this.consume = data.consume === true; // Remove stacks when triggered
        this.perStack = data.perStack === true; // Amount multiplied by stack count
        this.amount = data.amount; // Effect's base amount
        this.age = data.age; // For remove effects: trigger this many times before removal
        
        if(data.modifier !== undefined)
           this.modifier = data.modifier;

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
        // Amount is defined on the effect itself
        let amount = this.amount !== undefined ? this.amount : 1;

        let stacks = this.getStacks(instance);

        if(this.perStack)
            amount = Math.ceil(amount * stacks);

        if(this.modifier) {
            amount = Math.ceil(amount * this.modifier);
        }

        return amount;
    }

    getStacks(instance) {
        let stacks = instance.stacks;

        if(this.count)
            stacks = Math.ceil(stacks * this.count);

        return stacks;
    }
}

export class AdventuringAura extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this._media = data.media;
        this.name = data.name;
        this._descriptionTemplate = data.description; // Template with placeholders
        this.flavorText = data.flavorText; // Optional flavor text
        this.effects = data.effects.map(effect => new AdventuringAuraEffect(this.manager, this.game, this, effect));

        // combineMode: how the aura behaves when reapplied
        // - 'stack': add new stacks to existing (default if stackable)
        // - 'refresh': replace stacks with new value
        // - 'bySource': separate instances per source (ability, character, etc.)
        // - 'separate': always create new instance
        this.combineMode = data.combineMode || (data.stackable ? 'stack' : 'separate');
        
        this.stackable = data.stackable === true; // Whether this aura can have multiple stacks
        this.maxStacks = data.maxStacks; // Optional cap on stack count
        this.hidden = data.hidden === true; // Don't show in aura bar UI

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
        // If we have a template description, use it with placeholders
        if(this._descriptionTemplate) {
            const replacements = buildEffectReplacements(this.effects, instance, true);
            let desc = parseDescription(this._descriptionTemplate, replacements);
            if(this.flavorText) {
                desc = `${desc}\n\n${this.flavorText}`;
            }
            return desc;
        }
        
        // Auto-generate from effects
        const effectDescs = this.effects.map(effect => {
            const effectObj = {
                type: effect.type,
                trigger: effect.trigger || 'passive',
                value: effect.getAmount ? effect.getAmount(instance) : (this.amount || 0),
                stacks: effect.getStacks ? effect.getStacks(instance) : (instance?.stacks || this.stacks || 0),
                id: effect.id,
                target: effect.target,
                condition: effect.condition
            };
            return describeEffectFull(effectObj, this.manager);
        });
        
        let generated = effectDescs.join('. ');
        if(this.flavorText) {
            generated = generated ? `${generated}.\n\n${this.flavorText}` : this.flavorText;
        }
        return generated || this.name;
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

        this.component.nameText.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderDescription() {
        if(!this.renderQueue.description)
            return;
        
        this.component.description.innerHTML = this.getDescription();

        this.renderQueue.description = false;
    }
}