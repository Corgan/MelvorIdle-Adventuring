const { loadModule } = mod.getContext(import.meta);

const { AdventuringAuraInstance } = await loadModule('src/adventuring-aura-instance.mjs');
const { createEffect } = await loadModule('src/adventuring-utils.mjs');

const { AdventuringAurasElement } = await loadModule('src/components/adventuring-auras.mjs');

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

        this.component = createElement('adventuring-auras');

        this.renderQueue = new AdventuringAurasRenderQueue();
    }

    onLoad() {
        this.renderQueue.auras = true;
    }

    trigger(type) {
        let resolvedEffects = this.effectByType.get(type);
        return resolvedEffects !== undefined ? resolvedEffects : [];
    }

    /**
     * Get all effects from active auras as standardized effect objects.
     * Maps aura effect types to standard format.
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects() {
        const effects = [];
        
        for(const auraInstance of this.auras.values()) {
            if(auraInstance.base === undefined || auraInstance.stacks <= 0) continue;
            
            auraInstance.base.effects.forEach(effectData => {
                // Map aura triggers to standard triggers
                let trigger = effectData.trigger;
                if(trigger === 'stats') {
                    trigger = 'passive';
                }
                
                // Map aura effect types to standard types
                let type = effectData.type;
                let value = effectData.getAmount ? effectData.getAmount(auraInstance) : (effectData.amount || auraInstance.amount || 0);
                
                // Handle stacking effects
                if(effectData.stack) {
                    value = value * auraInstance.stacks;
                }
                
                // Handle reduce variants by negating the value
                if(type === 'reduce_stat_percent') {
                    type = 'increase_stat_percent';
                    value = -value;
                } else if(type === 'reduce_stat_flat') {
                    type = 'increase_stat_flat';
                    value = -value;
                }
                
                effects.push(createEffect(
                    {
                        trigger: trigger,
                        type: type,
                        stat: effectData.id,
                        value: value
                    },
                    auraInstance,
                    auraInstance.base.name
                ));
            });
        }
        
        return effects;
    }

    cleanAuras() {
        let auras = this.auras.values();
        for(let aura of auras) {
            if(aura.stacks === 0) {
                // stacks is already 0, so disconnectedCallback will destroy the tooltip
                this.auras.delete(aura);
            }
        }
    }

    clear() {
        // Set all stacks to 0 so tooltips get destroyed on disconnect
        for(let aura of this.auras.values()) {
            aura.stacks = 0;
        }
        this.auras.clear();
        this.effectByType.clear();
        this.renderQueue.auras = true;
        
        // Invalidate effect cache
        if(this.character && this.character.effectCache) {
            this.character.invalidateEffects('auras');
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
        
        if(!aura || typeof aura === 'string') {
            console.warn('[Auras.add] Invalid aura:', aura);
            return;
        }

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

            if(existingStacks !== existing.stacks || existingAmount !== existing.amount) {
                existing.set(existingStacks, existingAmount);
            }
        }
        this.renderQueue.auras = true;
        
        // Invalidate effect cache
        if(this.character && this.character.effectCache) {
            this.character.invalidateEffects('auras');
        }
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

        // Filter out hidden auras from the UI (they still function mechanically)
        let auras = [...this.auras.values()]
            .filter(aura => aura.base !== undefined && aura.stacks > 0 && !aura.base.hidden)
            .sort((a,b) => b.stacks - a.stacks);

        this.component.auras.replaceChildren(...auras.map(aura => aura.component));

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
            this.auras.add(aura);
        });
        this.buildEffects();
    }
}