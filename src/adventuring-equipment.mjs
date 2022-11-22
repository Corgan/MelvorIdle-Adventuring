const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringEquipmentSlot } = await loadModule('src/adventuring-equipment-slot.mjs');
const { AdventuringEquipmentUIComponent } = await loadModule('src/components/adventuring-equipment.mjs');

export class AdventuringEquipment {
    constructor(manager, game, character) {
        this.game = game;
        this.manager = manager;
        this.character = character;
        
        this.component = new AdventuringEquipmentUIComponent(this.manager, this.game, this);

        this.locked = false;
        this.slots = new Map();
        this.stats = new AdventuringStats(this.manager, this.game);
    }
    
    calculateStats() {
        this.stats.reset();
        this.slots.forEach((equipmentSlot, slotType) => {
            equipmentSlot.stats.forEach((value, stat) => {
                let old = this.stats.get(stat);
                this.stats.set(stat, old + value);
            });
        });
    }

    onLoad() {
        this.slots.forEach(slot => slot.onLoad());
    }

    setLocked(locked) {
        this.locked = locked;
        this.slots.forEach(slot => slot.setClickable(!this.locked));
    }

    selectSlot(selectedSlot) {
        if(this.selectedSlot === selectedSlot)
            return this.clearSelected();

        this.selectedSlot = selectedSlot;
        this.manager.stash.slots.forEach(slot => {
            slot.setSelected(slot === selectedSlot);
        });
        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(slot === selectedSlot)
                slot.setHighlight(slot.canEquip(selectedSlot.item, selectedSlot));
            });
        });
        this.manager.stash.renderQueue.details = true;
    }

    clearSelected() {
        this.selectedSlot = undefined;
        this.manager.stash.slots.forEach(slot => {
            slot.setSelected(false);
        });
        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(false);
                slot.setHighlight(false);
            });
        });
        this.manager.stash.renderQueue.details = true;
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