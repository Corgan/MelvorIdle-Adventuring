const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentSlot } = await loadModule('src/items/adventuring-equipment-slot.mjs');
const { AdventuringEquipmentElement } = await loadModule('src/items/components/adventuring-equipment.mjs');
const { createEffect, filterEffects } = await loadModule('src/core/utils/adventuring-utils.mjs');

export class AdventuringEquipment {
    constructor(manager, game, character) {
        this.game = game;
        this.manager = manager;
        this.character = character;

        this.component = createElement('adventuring-equipment');

        this.locked = false;
        this.slots = new Map();
    }

    get equippedItems() {
        const items = [];
        this.slots.forEach((slot) => {
            if (slot.item && slot.item !== this.manager.cached.noneItem && !slot.occupied) {
                items.push(slot.item);
            }
        });
        return items;
    }

    forEachEquipped(callback) {
        this.slots.forEach((slot, slotType) => {
            if (slot.item && slot.item !== this.manager.cached.noneItem && !slot.occupied) {
                callback(slot.item, slot, slotType);
            }
        });
    }

    /**
     * Iterate only valid equipped items (items that match current job)
     * Invalid items provide no stats/effects
     */
    forEachValidEquipped(callback) {
        this.forEachEquipped((item, slot, slotType) => {
            if (slot.canEquip(item)) {
                callback(item, slot, slotType);
            }
        });
    }

    hasItemEquipped(item) {
        let found = false;
        this.slots.forEach((slot) => {
            if (slot.item === item) {
                found = true;
            }
        });
        return found;
    }

    getSetPieceCounts() {

        if(this._cachedSetCounts !== undefined) {
            return this._cachedSetCounts;
        }

        const counts = new Map();
        this.forEachValidEquipped((item) => {
            if(item.set) {
                counts.set(item.set, (counts.get(item.set) || 0) + 1);
            }
        });
        this._cachedSetCounts = counts;
        return counts;
    }

    invalidateSetCache() {
        this._cachedSetCounts = undefined;
    }

    /**
     * Recalculate stats for all equipped items (for tooltip display).
     * Note: Equipment stats flow to hero via getEffects() → effectCache.
     */
    calculateStats() {
        this.forEachValidEquipped((item, slot) => {
            item.calculateStats(this.character);
        });
    }

    /**
     * Get all effects from equipped items (stats + procs + set bonuses).
     * Unified method for effectCache integration.
     * @param {Object} filters - Optional filters (trigger, party, type, etc.)
     * @returns {Array} Filtered effects with source metadata
     */
    getEffects(filters = {}) {
        // Handle legacy string trigger parameter
        if (typeof filters === 'string') {
            filters = { trigger: filters };
        }
        const trigger = filters.trigger;
        
        let effects = [];

        this.forEachValidEquipped((item, slot) => {
            // 1. All effects from items (stats + special effects)
            if (item.getEffects) {
                const itemEffects = item.getEffects(this.character);
                for (const effect of itemEffects) {
                    if (trigger !== undefined && effect.trigger !== trigger) continue;
                    effects.push(effect);
                }
            }

            // 2. Legacy item.effects array (buffs, triggers, procs) - for items not yet converted
            if (item.effects && item.effects.length > 0) {
                item.effects.forEach(effect => {
                    if (trigger !== undefined && effect.trigger !== trigger) return;

                    let amount = effect.amount || 0;
                    if (effect.scaling && item.level > 0) {
                        amount += Math.floor(item.level * effect.scaling);
                    }

                    effects.push(createEffect(
                        {
                            trigger: effect.trigger || 'passive',
                            type: effect.type,
                            stat: effect.stat || effect.id,
                            value: amount,
                            target: effect.target,
                            chance: effect.chance,
                            party: effect.party
                        },
                        [{ type: 'equipment', name: item.name, ref: item }]
                    ));
                });
            }
        });

        // 3. Equipment set bonuses
        if (this.character && this.manager && this.manager.equipmentSets) {
            const setCounts = this.getSetPieceCounts();
            setCounts.forEach((count, set) => {
                if (count <= 0) return;
                const setEffects = set.getActiveEffects(this.character);
                setEffects.forEach(effect => {
                    if (trigger !== undefined && effect.trigger !== trigger) return;
                    
                    // Effects already have sourcePath from set.getActiveEffects()
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
                            threshold: effect.threshold,
                            party: effect.party
                        },
                        effect.sourcePath || [{ type: 'equipmentSet', name: set.name, ref: set }]
                    ));
                });
            });
        }

        return filterEffects(effects, filters);
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
        const noneItem = this.manager.cached.noneItem;
        const noneSlot = this.manager.itemSlots.getObjectByID('adventuring:none');
        const equippedSlots = [...this.slots.entries()].filter(([_, slot]) => 
            slot.item && slot.item !== noneItem
        );
        
        writer.writeUint8(equippedSlots.length);
        for (const [slotType, slot] of equippedSlots) {
            writer.writeNamespacedObject(slotType);
            slot.encode(writer);
        }
    }

    decode(reader, version) {
        const numSlots = reader.getUint8();
        for (let i = 0; i < numSlots; i++) {
            const slotType = reader.getNamespacedObject(this.manager.itemSlots);
            const slot = this.slots.get(slotType);
            if (slot) {
                slot.decode(reader, version);
            } else {
                reader.getNamespacedObject(this.manager.baseItems);
                reader.getNamespacedObject(this.manager.itemSlots);
            }
        }
    }
}