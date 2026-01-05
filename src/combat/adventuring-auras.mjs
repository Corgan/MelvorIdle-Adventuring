const { loadModule } = mod.getContext(import.meta);

const { AdventuringAuraInstance } = await loadModule('src/combat/adventuring-aura-instance.mjs');
const { createEffect } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringAurasElement } = await loadModule('src/combat/components/adventuring-auras.mjs');

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
        
        // Map for O(1) lookup of aura instances by base aura
        // Maps: aura.id -> Map(source -> instance) for bySource mode
        //       or aura.id -> instance for stack/refresh modes
        this.aurasByBase = new Map();

        this.effectByType = new Map();

        this.component = createElement('adventuring-auras');

        this.renderQueue = new AdventuringAurasRenderQueue();
    }

    onLoad() {
        this.renderQueue.auras = true;
    }

    trigger(type) {
        let resolvedEffects = this.effectByType.get(type);
        
        // Increment age of all auras at round_end
        if (type === 'round_end') {
            this.incrementAges();
        }
        
        return resolvedEffects !== undefined ? resolvedEffects : [];
    }
    
    /**
     * Increment the age of all active auras.
     * Age tracks how many rounds the aura has been active.
     */
    incrementAges() {
        for (const auraInstance of this.auras.values()) {
            if (auraInstance.base === undefined || auraInstance.stacks <= 0) continue;
            auraInstance.age = (auraInstance.age || 0) + 1;
        }
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
                const trigger = effectData.trigger;
                const type = effectData.type;
                // getAmount already handles perStack multiplication
                const value = effectData.getAmount ? effectData.getAmount(auraInstance) : (effectData.amount || 0);
                
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
                this._removeFromCache(aura.base, aura.source);
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
        this.aurasByBase.clear();
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

    add(aura, { stacks = 1 }, source) {
        // Handle undefined or null early
        if(!aura) {
            console.warn('[Auras.add] Invalid aura: undefined or null', new Error().stack);
            return;
        }
        
        const originalAuraId = aura;
        if(typeof aura === "string") {
            // Add namespace if missing
            if(!aura.includes(':')) {
                aura = `adventuring:${aura}`;
            }
            aura = this.manager.auras.getObjectByID(aura);
        }
        
        if(!aura || typeof aura === 'string') {
            console.warn(`[Auras.add] Aura not found: ${originalAuraId}`, new Error().stack);
            return;
        }

        // Determine if we should find an existing instance based on combineMode
        let existing = undefined;
        if(aura.combineMode === 'stack' || aura.combineMode === 'refresh') {
            existing = this.get(aura); // Find any existing instance
        } else if(aura.combineMode === 'bySource') {
            existing = this.get(aura, source); // Find instance from same source
        }
        // combineMode === 'separate' always creates new instance

        if(existing === undefined) {
            // Create a new instance
            let instance = new AdventuringAuraInstance(this.manager, this.game, this, source);
            this.auras.add(instance);
            instance.setAura(aura, stacks);
            
            // Add to aurasByBase cache
            this._addToCache(aura, instance, source);
        } else {
            // Update existing instance based on combineMode
            let newStacks = existing.stacks;
            if(aura.combineMode === 'stack' || aura.combineMode === 'bySource') { // Both modes add stacks
                newStacks = existing.stacks + stacks;
            } else if(aura.combineMode === 'refresh') {
                newStacks = stacks;
                existing.age = 0; // Reset age on refresh
            }
            
            // Enforce maxStacks if defined
            if(aura.maxStacks !== undefined) {
                newStacks = Math.min(newStacks, aura.maxStacks);
            }
            
            if(newStacks !== existing.stacks) {
                existing.setStacks(newStacks);
            }
        }
        this.renderQueue.auras = true;
        
        // Invalidate effect cache
        if(this.character && this.character.effectCache) {
            this.character.invalidateEffects('auras');
        }
    }
    
    /**
     * Add an instance to the aurasByBase cache
     */
    _addToCache(aura, instance, source) {
        if (!this.aurasByBase.has(aura.id)) {
            this.aurasByBase.set(aura.id, new Map());
        }
        const sourceKey = source !== undefined ? source : '_default';
        this.aurasByBase.get(aura.id).set(sourceKey, instance);
    }
    
    /**
     * Remove an instance from the aurasByBase cache
     */
    _removeFromCache(aura, source) {
        if (!aura || !this.aurasByBase.has(aura.id)) return;
        const sourceKey = source !== undefined ? source : '_default';
        const instances = this.aurasByBase.get(aura.id);
        instances.delete(sourceKey);
        if (instances.size === 0) {
            this.aurasByBase.delete(aura.id);
        }
    }

    get(aura, source) {
        if(typeof aura === "string") 
            aura = this.manager.auras.getObjectByID(aura);
        
        if (!aura) return undefined;
        
        // Use cache for O(1) lookup
        const instances = this.aurasByBase.get(aura.id);
        if (!instances) return undefined;
        
        if (source !== undefined) {
            return instances.get(source);
        }
        // If no source specified, return first matching instance
        for (const instance of instances.values()) {
            if (instance.base === aura) return instance;
        }
        return undefined;
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