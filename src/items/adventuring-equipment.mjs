const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringEquipmentSlot } = await loadModule('src/items/adventuring-equipment-slot.mjs');
const { AdventuringEquipmentElement } = await loadModule('src/items/components/adventuring-equipment.mjs');
const { createEffect } = await loadModule('src/core/adventuring-utils.mjs');

export class AdventuringEquipment {
    constructor(manager, game, character) {
        this.game = game;
        this.manager = manager;
        this.character = character;
        
        this.component = createElement('adventuring-equipment');

        this.locked = false;
        this.slots = new Map();
        this.stats = new AdventuringStats(this.manager, this.game);
    }
    
    calculateStats() {
        this.stats.reset();
        this.slots.forEach((equipmentSlot, slotType) => {
            equipmentSlot.item.calculateStats();
            if(equipmentSlot.canEquip(equipmentSlot.item)) {
                equipmentSlot.stats.forEach((value, stat) => {
                    let old = this.stats.get(stat);
                    this.stats.set(stat, old + value);
                });
            }
        });
    }

    /**
     * Get all effects from equipped items as StandardEffect objects.
     * Includes both passive stat bonuses and trigger-based effects.
     * @param {string} [trigger] - Optional filter by trigger type
     * @returns {StandardEffect[]} Array of standardized effects
     */
    getEffects(trigger = null) {
        const effects = [];
        
        this.slots.forEach((equipmentSlot, slotType) => {
            if(!equipmentSlot.canEquip(equipmentSlot.item)) return;
            
            const item = equipmentSlot.item;
            
            // Add passive stat bonuses from equipment stats
            if(trigger === null || trigger === 'passive') {
                item.stats.forEach((value, stat) => {
                    if(value !== 0) {
                        effects.push(createEffect(
                            {
                                trigger: 'passive',
                                type: 'increase_stat_flat',
                                stat: stat.id,
                                value: value
                            },
                            item,
                            item.name
                        ));
                    }
                });
            }
            
            // Add trigger-based effects from item effects array
            if(item.effects && item.effects.length > 0) {
                item.effects.forEach(effect => {
                    // Skip if filtering by trigger and doesn't match
                    if(trigger !== null && effect.trigger !== trigger) return;
                    
                    // Calculate effect amount based on item level scaling
                    let amount = effect.amount || 0;
                    if(effect.scaling && item.level > 0) {
                        amount += Math.floor(item.level * effect.scaling);
                    }
                    
                    effects.push(createEffect(
                        {
                            trigger: effect.trigger || 'passive',
                            type: effect.type,
                            stat: effect.stat || effect.id,
                            value: amount,
                            target: effect.target,
                            chance: effect.chance
                        },
                        item,
                        item.name
                    ));
                });
            }
        });
        
        // Add equipment set bonus effects
        if(this.character && this.manager && this.manager.equipmentSets) {
            this.manager.equipmentSets.forEach(set => {
                const setEffects = set.getActiveEffects(this.character);
                setEffects.forEach(effect => {
                    // Skip if filtering by trigger and doesn't match
                    if(trigger !== null && effect.trigger !== trigger) return;
                    
                    effects.push(createEffect(
                        {
                            trigger: effect.trigger || 'passive',
                            type: effect.type,
                            stat: effect.stat,
                            amount: effect.amount,
                            id: effect.id,
                            stacks: effect.stacks,
                            chance: effect.chance,
                            count: effect.count,
                            threshold: effect.threshold
                        },
                        { name: effect.sourceName },
                        effect.sourceName
                    ));
                });
            });
        }
        
        return effects;
    }
    
    /**
     * Get all effects from equipment that match a trigger type.
     * Does NOT evaluate conditions or limits - those are handled by the central dispatcher.
     * @param {string} triggerType - The trigger type to match
     * @param {object} context - Context for evaluation (not used here, passed for interface consistency)
     * @returns {Array<{item: object, effect: object}>}
     */
    getEffectsForTrigger(triggerType, context = {}) {
        const results = [];
        
        // Individual equipment item effects
        this.slots.forEach((equipmentSlot, slotType) => {
            if (!equipmentSlot.canEquip(equipmentSlot.item)) return;
            
            const item = equipmentSlot.item;
            if (!item.effects || item.effects.length === 0) return;
            
            item.effects.forEach(effect => {
                if (effect.trigger !== triggerType) return;
                
                results.push({
                    item: item,
                    effect: effect
                });
            });
        });
        
        // Equipment set bonus effects
        if (this.character && this.manager && this.manager.equipmentSets) {
            this.manager.equipmentSets.forEach(set => {
                const setEffects = set.getActiveEffects(this.character);
                setEffects.forEach(effect => {
                    if (effect.trigger !== triggerType) return;
                    
                    results.push({
                        item: { 
                            name: effect.sourceName,
                            level: 0,
                            isSetBonus: true
                        },
                        effect: effect
                    });
                });
            });
        }
        
        return results;
    }

    onLoad() {
        this.slots.forEach(slot => slot.onLoad());
    }

    setLocked(locked) {
        this.locked = locked;
        this.slots.forEach(slot => slot.setClickable(!this.locked));
    }

    render() {
        this.slots.forEach(slot => slot.render());
    }

    postDataRegistration() {
        this.manager.itemSlots.forEach(slot => {
            if(slot !== this.manager.cached.noneItemSlot)
                this.slots.set(slot, new AdventuringEquipmentSlot(this.manager, this.game, this, slot))
        });
        
        this.slots.forEach(slot => {
            let $anchor = this.component.equipment.querySelector(`[data-slot="${slot.slotType.id}"]`);
            if($anchor)
                slot.component.mount($anchor);
        });
    }

    encode(writer) {
        writer.writeComplexMap(this.slots, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            value.encode(writer);
        });
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let slot = reader.getNamespacedObject(this.manager.itemSlots);
            this.slots.get(slot).decode(reader, version);
        });
    }
}