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
        this.forEachEquipped((item) => {
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

    calculateStats() {
        this.stats.reset();
        this.forEachEquipped((item, slot) => {

            item.calculateStats(this.character);
            slot.stats.forEach((value, stat) => {
                let old = this.stats.get(stat);
                this.stats.set(stat, old + value);
            });
        });
    }

    getEffects(trigger = null) {
        const effects = [];

        this.forEachEquipped((item, slot) => {

            if(trigger === null || trigger === 'passive') {
                item.stats.forEach((value, stat) => {
                    if(value !== 0) {
                        effects.push(createEffect(
                            {
                                trigger: 'passive',
                                type: 'stat_flat',
                                stat: stat.id,
                                value: value
                            },
                            item,
                            item.name
                        ));
                    }
                });
            }

            if(item.effects && item.effects.length > 0) {
                item.effects.forEach(effect => {

                    if(trigger !== null && effect.trigger !== trigger) return;

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

        if(this.character && this.manager && this.manager.equipmentSets) {
            const setCounts = this.getSetPieceCounts();
            setCounts.forEach((count, set) => {
                if(count <= 0) return;
                const setEffects = set.getActiveEffects(this.character);
                setEffects.forEach(effect => {

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

    getEffectsForTrigger(triggerType, context = {}) {
        const results = [];

        this.forEachEquipped((item, slot) => {
            if (!item.effects || item.effects.length === 0) return;

            item.effects.forEach(effect => {
                if (effect.trigger !== triggerType) return;

                results.push({
                    item: item,
                    effect: effect
                });
            });
        });

        if (this.character && this.manager && this.manager.equipmentSets) {
            const setCounts = this.getSetPieceCounts();
            setCounts.forEach((count, set) => {
                if(count <= 0) return;
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
            writer.pushPath?.(key.id);
            value.encode(writer);
            writer.popPath?.();
        });
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let slot = reader.getNamespacedObject(this.manager.itemSlots);
            this.slots.get(slot).decode(reader, version);
        });
    }
}