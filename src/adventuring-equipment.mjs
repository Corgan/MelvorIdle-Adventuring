const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentSlot } = await loadModule('src/adventuring-equipment-slot.mjs');
const { AdventuringEquipmentUIComponent } = await loadModule('src/components/adventuring-equipment.mjs');

export class AdventuringEquipment {
    static slots = [
        'Weapon',
        'Shield',

        'Amulet',
        'Ring',
        'Cape',

        'Helmet',
        'Platebody',
        'Platelegs',
        'Gloves',
        'Boots'
    ];

    constructor(manager, game, character) {
        this.game = game;
        this.manager = manager;
        this.character = character;
        
        this.component = new AdventuringEquipmentUIComponent(this.manager, this.game);

        this.locked = false;
        this.slots = new Map();
        
        AdventuringEquipment.slots.forEach(slot => this.slots.set(slot, new AdventuringEquipmentSlot(this.manager, this.game, this, slot)));
        
        this.slots.forEach(slot => slot.component.mount(this.component.equipmentContainer));
    }
    
    get levels() {
        //['Hitpoints', 'Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Prayer', 'Agility']
        return [...this.slots].reduce((total, [_, slot]) => {
            [...slot.levels].forEach(([skill, level]) => {
                total[skill] = (total[skill] !== undefined ? total[skill] + level : level);
            });
            return total;
        }, {})
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
                slot.setHighlight(slot.canEquip(selectedSlot.item));
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

    encode(writer) {
        writer.writeComplexMap(this.slots, (key, value, writer) => {
            writer.writeString(key);
            value.encode(writer);
        });
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getString();
            this.slots.get(key).decode(reader, version);
        });
    }
}