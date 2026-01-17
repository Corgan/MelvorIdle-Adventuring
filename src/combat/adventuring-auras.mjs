const { loadModule } = mod.getContext(import.meta);

const { AdventuringAuraInstance } = await loadModule('src/combat/adventuring-aura-instance.mjs');
const { createEffect, evaluateCondition, buildEffectContext, defaultEffectProcessor } = await loadModule('src/core/adventuring-utils.mjs');

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

        this.aurasByBase = new Map();

        this.component = createElement('adventuring-auras');

        this.renderQueue = new AdventuringAurasRenderQueue();
    }

    onLoad() {
        this.renderQueue.auras = true;
    }

    incrementAges() {
        for (const auraInstance of this.auras.values()) {
            if (auraInstance.base === undefined || auraInstance.stacks <= 0) continue;
            auraInstance.age = (auraInstance.age || 0) + 1;
        }
    }

    /**
     * Get effects from active auras
     * @param {Object} filters - Optional filters (trigger, party, type, etc.)
     * @returns {Array} Filtered effects with source metadata
     */
    getEffects(filters = {}) {
        // Handle legacy string trigger parameter
        if (typeof filters === 'string') {
            filters = { trigger: filters };
        }
        
        let effects = [];

        for(const auraInstance of this.auras.values()) {
            if(auraInstance.base === undefined || auraInstance.stacks <= 0) continue;

            auraInstance.base.effects.forEach(effectData => {
                const trigger = effectData.trigger;
                const type = effectData.type;

                let value = effectData.getAmount ? effectData.getAmount(auraInstance) : (effectData.amount || 0);
                
                // Scale by stacks if perStack is true
                if (effectData.perStack && auraInstance.stacks > 0) {
                    value = value * auraInstance.stacks;
                }

                effects.push(createEffect(
                    {
                        trigger: trigger,
                        type: type,
                        stat: effectData.id,
                        value: value,
                        party: effectData.party,
                        target: effectData.target
                    },
                    auraInstance,
                    auraInstance.base.name,
                    'aura'
                ));
            });
        }

        // Apply filters
        if (filters && Object.keys(filters).length > 0) {
            effects = effects.filter(effect => {
                if (filters.trigger !== undefined && effect.trigger !== filters.trigger) return false;
                if (filters.party !== undefined && effect.party !== filters.party) return false;
                if (filters.type !== undefined && effect.type !== filters.type) return false;
                return true;
            });
        }

        return effects;
    }

    cleanAuras() {
        let auras = this.auras.values();
        for(let aura of auras) {
            if(aura.stacks === 0) {

                if (this.character && aura.base && aura.base.effects) {
                    const removedEffects = aura.base.effects.filter(e => e.trigger === 'removed');
                    if (removedEffects.length > 0) {
                        const ctx = {
                            character: this.character,
                            manager: this.character.manager,
                            extra: { source: aura.source, aura: aura.base }
                        };
                        for (const effect of removedEffects) {
                            defaultEffectProcessor.processEffect(
                                effect,
                                effect.amount || 0,
                                effect.stacks || 1,
                                aura.base?.name || 'Aura',
                                ctx
                            );
                        }
                    }
                }

                this._removeFromCache(aura.base, aura.source);
                this.auras.delete(aura);
                this.renderQueue.auras = true;
            }
        }
    }

    clear() {

        for(let aura of this.auras.values()) {
            aura.stacks = 0;
        }
        this.auras.clear();
        this.aurasByBase.clear();
        this.renderQueue.auras = true;

        if(this.character && this.character.effectCache) {
            this.character.invalidateEffects('auras');
        }
    }

    buildEffects() {
        this.cleanAuras();
    }

    _captureSnapshot(source) {
        if (!source || !source.stats) return null;

        const snapshot = new Map();
        source.stats.forEach((value, key) => {
            snapshot.set(key, value);
        });
        return snapshot;
    }

    _needsSnapshot(aura) {
        if (!aura || !aura.effects) return false;
        return aura.effects.some(effect => effect.scaleFrom === 'snapshot');
    }

    add(aura, { stacks = 1 }, source) {

        if(!aura) {
            console.warn('[Auras.add] Invalid aura: undefined or null', new Error().stack);
            return;
        }

        const originalAuraId = aura;
        if(typeof aura === "string") {

            if(!aura.includes(':')) {
                aura = `adventuring:${aura}`;
            }
            aura = this.manager.auras.getObjectByID(aura);
        }

        if(!aura || typeof aura === 'string') {
            console.warn(`[Auras.add] Aura not found: ${originalAuraId}`, new Error().stack);
            return;
        }

        let existing = undefined;
        if(aura.combineMode === 'stack' || aura.combineMode === 'refresh') {
            existing = this.get(aura); // Find any existing instance
        } else if(aura.combineMode === 'bySource') {
            existing = this.get(aura, source); // Find instance from same source
        }


        const needsSnap = this._needsSnapshot(aura);
        let snapshot = null;
        if (needsSnap) {
            snapshot = this._captureSnapshot(source);
        }

        if(existing === undefined) {

            let instance = new AdventuringAuraInstance(this.manager, this.game, this, source);
            this.auras.add(instance);
            instance.setAura(aura, stacks, snapshot);

            this._addToCache(aura, instance, source);
        } else {

            let newStacks = existing.stacks;
            if(aura.combineMode === 'stack' || aura.combineMode === 'bySource') { // Both modes add stacks
                newStacks = existing.stacks + stacks;

                if (needsSnap && snapshot) {
                    existing.snapshotStats = snapshot;
                }
            } else if(aura.combineMode === 'refresh') {
                newStacks = stacks;
                existing.age = 0; // Reset age on refresh

                if (needsSnap && snapshot) {
                    existing.snapshotStats = snapshot;
                }
            }

            if(aura.maxStacks !== undefined) {
                newStacks = Math.min(newStacks, aura.maxStacks);
            }

            if(newStacks !== existing.stacks) {
                existing.setStacks(newStacks);
            }
        }
        this.renderQueue.auras = true;

        if(this.character && this.character.effectCache) {
            this.character.invalidateEffects('auras');
        }
    }

    _addToCache(aura, instance, source) {
        if (!this.aurasByBase.has(aura.id)) {
            this.aurasByBase.set(aura.id, new Map());
        }
        const sourceKey = source !== undefined ? source : '_default';
        this.aurasByBase.get(aura.id).set(sourceKey, instance);
    }

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

        const instances = this.aurasByBase.get(aura.id);
        if (!instances) return undefined;

        if (source !== undefined) {
            return instances.get(source);
        }

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