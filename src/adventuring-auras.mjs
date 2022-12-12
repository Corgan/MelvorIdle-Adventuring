const { loadModule } = mod.getContext(import.meta);

const { AdventuringAuraInstance } = await loadModule('src/adventuring-aura-instance.mjs');

const { AdventuringAurasUIComponent } = await loadModule('src/components/adventuring-auras.mjs');

class AdventuringAurasRenderQueue {
    constructor() {
        this.auras = false;
    }
}

export class AdventuringAuras {
    constructor(manager, game, character) {
        this.manager = manager;
        this.game = game;
        this.character = character;

        this.auras = new Set();

        this.effectByType = new Map();

        this.component = new AdventuringAurasUIComponent(this.manager, this.game);

        this.renderQueue = new AdventuringAurasRenderQueue();
    }

    onLoad() {
        this.renderQueue.auras = true;
    }

    trigger(type) {
        let resolvedEffects = this.effectByType.get(type);
        return resolvedEffects !== undefined ? resolvedEffects : [];
    }

    cleanAuras() {
        let auras = this.auras.values();
        for(let aura of auras) {
            if(aura.stacks === 0) {
                aura.component.tooltip.destroy();
                this.auras.delete(aura);
            }
        }
    }

    buildEffects() {
        this.cleanAuras();
        this.effectByType.clear();

        let auras = this.auras.values();

        for(let auraInstance of auras) {
            if(auraInstance.base !== undefined && auraInstance.stacks > 0) {
                auraInstance.base.effects.forEach(effect => {
                    let existing = this.effectByType.get(effect.trigger);
                    if(existing === undefined)
                        existing = [];
                    existing.push({
                        instance: auraInstance,
                        effect: effect
                    });
                    this.effectByType.set(effect.trigger, existing);
                });
            }
        }
    }

    add(aura, { amount, stacks }, source) {
        if(typeof aura === "string")
            aura = this.manager.auras.getObjectByID(aura);
        
        let existing = this.get(aura, !aura.combine ? source : undefined);

        if(existing === undefined || !(aura.stack || aura.refresh || aura.accumulate || aura.overwrite)) { // Create a new Aura if we don't stack and we don't refresh, or we don't exist yet
            let instance = new AdventuringAuraInstance(this.manager, this.game, this, source);
            this.auras.add(instance);
            instance.setAura(aura, stacks, amount);
        } else {
            let existingStacks = existing.stacks;
            let existingAmount = existing.amount;
            if(aura.stack)
                existingStacks = existingStacks + stacks;
            if(aura.refresh)
                existingStacks = stacks;
            if(aura.accumulate)
                existingAmount = existingAmount + amount;
            if(aura.overwrite)
                existingAmount = amount;

            if(existingStacks !== existing.stacks || existingAmount !== existing.amount)
                existing.set(existingStacks, existingAmount)
        }
        this.renderQueue.auras = true;
    }

    get(aura, source) {
        if(typeof aura === "string") 
            aura = this.manager.auras.getObjectByID(aura);
        
        for(let auraInstance of this.auras.values()) {
            if(auraInstance.base === aura && (source === undefined || source === auraInstance.source))
                return auraInstance;
        }
    }

    onLoad() {
        
    }

    postDataRegistration() {

    }

    render() {
        this.auras.forEach(aura => aura.render());

        if(!this.renderQueue.auras)
            return;

        let auras = [...this.auras.values()].filter(aura => aura.base !== undefined && aura.stacks > 0).sort((a,b) => b.stacks - a.stacks);

        this.component.auras.replaceChildren(...auras.map(aura => aura.component.$elements).flat());

        this.renderQueue.auras = false;
    }

    encode(writer) {
        writer.writeSet(this.auras, (aura, writer) => {
            aura.encode(writer);
        });
        return writer;
    }

    decode(reader, version) {
        reader.getSet((reader) => {
            let aura = new AdventuringAuraInstance(this.manager, this.game, this);
            aura.decode(reader, version);
            this.auras.add(instance);
        });
        this.buildEffects();
    }
}