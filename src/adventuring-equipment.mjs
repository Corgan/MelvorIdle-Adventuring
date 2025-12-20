const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringEquipmentSlot } = await loadModule('src/adventuring-equipment-slot.mjs');
const { AdventuringEquipmentElement } = await loadModule('src/components/adventuring-equipment.mjs');

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
            if(slot.id !== "adventuring:none")
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