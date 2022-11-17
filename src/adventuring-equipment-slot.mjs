const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

const { AdventuringEquipmentSlotUIComponent } = await loadModule('src/components/adventuring-equipment-slot.mjs');

class AdventuringEquipmentSlotRenderQueue {
    constructor() {
        this.icon = false;
        this.highlight = false;
        this.selected = false;
        this.clickable = false;
    }
}

export class AdventuringEquipmentSlot {
    constructor(manager, game, equipment, slot) {
        this.game = game;
        this.manager = manager;
        this.equipment = equipment;
        this.slot = slot;
        this.occupiedBy = 'None';
        this.item = this.manager.emptyEquipmentItem;
        this.highlight = false;
        this.clickable = false;
        this.selected = false;

        this.renderQueue = new AdventuringEquipmentSlotRenderQueue();

        this.component = new AdventuringEquipmentSlotUIComponent(this.manager, this.game);

        this.component.icon.onclick = () => {
            this.slotClicked();
        }
    }

    onLoad() {
        this.renderQueue.icon = true;
        this.renderQueue.highlight = true;
        this.renderQueue.clickable = true;
        this.renderQueue.valid = true;
    }

    canEquip(item) {
        if(item === this.manager.emptyEquipmentItem)
            return true;
        if(!item.slots.includes(this.slot))
            return false;
        if(!item.jobs.includes(this.equipment.character.job))
            return false;
        if(item.pairs.length > 0) {
            let pairedSlots = ["Weapon", "Shield"].filter(slot => slot !== this.slot);
            let validPairs = pairedSlots.reduce((valid, slot) => {
                let equipmentSlot = this.equipment.slots.get(slot);
                if(!equipmentSlot.empty && !equipmentSlot.occupied && !item.pairs.includes(equipmentSlot.item.type))
                    return false;
                return valid;
            }, true);
            return validPairs;
        }
        return true;
    }

    slotClicked() {
        if(this.manager.pages.active !== this.manager.stash)
            return;
        
        if(this.manager.stash.selectedSlot !== undefined) {
            let newItem = this.manager.stash.selectedSlot.item;
            let oldItem = this.item;

            let newOccupiedItems = newItem.occupies.map(slot => this.equipment.slots.get(slot))
                .filter(slot => !slot.empty && !slot.occupied).map(slot => slot.item);

            if(this.manager.stash.emptyCount < newOccupiedItems.length) {
                imageNotify(cdnMedia('assets/media/main/bank_header.svg'), "Your stash is full.", 'danger');
                return;
            }

            if(this.canEquip(newItem)) {
                this.setEquipped(newItem);
                this.manager.stash.selectedSlot.setItem(oldItem);
                newOccupiedItems.forEach(item => {
                    this.manager.stash.firstEmpty.setItem(item);
                });
                this.manager.stash.clearSelected();
            }
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) { // An equipment item is selected
                if(selectedEquipment.selectedSlot === this) {
                    selectedEquipment.clearSelected(); // Deselect the selected item
                } else {
                    let newItem = selectedEquipment.selectedSlot.item;
                    let oldItem = this.item;

                    let newOccupiedSlots = newItem.occupies.map(slot => selectedEquipment.slots.get(slot)).filter(slot => !slot.empty && slot.occupied);
                    let newEquippedSlotItems = newItem.occupies.map(slot => this.equipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => ({ slot: slot.slot, item: slot.item }));

                    let oldOccupiedSlots = oldItem.occupies.map(slot => this.equipment.slots.get(slot)).filter(slot => !slot.empty && slot.occupied);
                    let oldEquippedSlotItems = oldItem.occupies.map(slot => selectedEquipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => ({ slot: slot.slot, item: slot.item }));
                    
                    if(this.manager.stash.emptyCount < newEquippedSlotItems.length + oldEquippedSlotItems.length) {
                        imageNotify(cdnMedia('assets/media/main/bank_header.svg'), "Your stash is full.", 'danger');
                        return;
                    }

                    if(this.canEquip(newItem) && selectedEquipment.selectedSlot.canEquip(oldItem)) {
                        this.setEquipped(newItem);
                        selectedEquipment.selectedSlot.setEquipped(oldItem);

                        newOccupiedSlots.forEach(slot => {
                            slot.setEmpty();
                        });
                        oldOccupiedSlots.forEach(slot => {
                            slot.setEmpty();
                        });

                        oldEquippedSlotItems.forEach(({ slot, item }) => {
                            if(this.equipment.slots.get(slot).canEquip(item)) {
                                this.equipment.slots.get(slot).setEquipped(item);
                            } else {
                                this.manager.stash.firstEmpty.setItem(item);
                            }
                        });
                        newEquippedSlotItems.forEach(({ slot, item }) => {
                            if(selectedEquipment.slots.get(slot).canEquip(item)) {
                                selectedEquipment.slots.get(slot).setEquipped(item);
                            } else {
                                this.manager.stash.firstEmpty.setItem(item);
                            }
                        });
                        selectedEquipment.clearSelected();
                    } else {
                        if(!this.empty) {
                            selectedEquipment.clearSelected();
                            this.equipment.selectSlot(this);
                        }
                    }
                }
            } else { // Nothing selected
                if(!this.empty && !this.occupied) { // Has item equipped and not occupied
                    this.equipment.selectSlot(this);
                }
            }
        }

        this.manager.party.all.forEach(member => member.calculateLevels());
    }

    setOccupied(slot) {
        this.item = this.manager.emptyEquipmentItem;
        this.occupiedBy = slot;
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
    }

    setEquipped(item) {
        this.item = item;
        this.occupiedBy = 'None';
        this.item.occupies.forEach(slot => {
            let equipmentSlot = this.equipment.slots.get(slot);
            equipmentSlot.setOccupied(this.slot);
        });
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
    }

    setEmpty() {
        this.item = this.manager.emptyEquipmentItem;
        this.occupiedBy = 'None';
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
    }

    get empty() {
        return this.item == this.manager.emptyEquipmentItem && !this.occupied;
    }

    get occupied() {
        return this.occupiedBy != 'None';
    }
    
    get levels() {
        return !this.empty ? this.item.levels : new Map();
    }

    setSelected(selected) {
        this.selected = selected;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
        this.renderQueue.selected = true;
    }

    setClickable(clickable) {
        this.clickable = clickable;
        this.renderQueue.clickable = true;
    }

    render() {
        this.renderIcon();
        this.renderValid();
        this.renderHighlight();
        this.renderSelected();
        this.renderClickable();
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        let media;
        let tooltip;
        if(!this.empty) {
            if(this.occupied) {
                let occupiedSlot = this.equipment.slots.get(this.occupiedBy);
                media = occupiedSlot.item.media;
                tooltip = occupiedSlot.item.tooltip;
            } else {
                media = this.item.media;
                tooltip = this.item.tooltip;
            }
        } else {
            media = cdnMedia(`assets/media/bank/${equipmentSlotData[this.slot].emptyMedia}.png`)
            tooltip = "Empty";
        }

        this.component.icon.src = media;
        this.component.icon.classList.toggle('opacity-40', !this.empty && this.occupied);

        this.component.tooltip.setContent(tooltip);

        this.renderQueue.icon = false;
    }

    renderValid() {
        if(!this.renderQueue.valid)
            return;

        this.component.icon.classList.toggle('border-danger', !this.canEquip(this.item));

        this.renderQueue.valid = false;
    }

    renderSelected() {
        if(!this.renderQueue.selected)
            return;

        this.component.icon.classList.toggle('border-success', this.selected);

        this.renderQueue.selected = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.icon.classList.toggle('border-warning', this.highlight && !this.selected);

        this.renderQueue.highlight = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.icon.classList.toggle('pointer-enabled', this.clickable);

        this.renderQueue.clickable = false;
    }

    encode(writer) {
        writer.writeBoolean(!this.empty && !this.occupied)
        if(!this.empty && !this.occupied)
            this.item.encode(writer);
        writer.writeString(this.occupiedBy);
        return writer;
    }

    decode(reader, version) {
        if(reader.getBoolean()) {
            this.item = new AdventuringEquipmentItem(this.manager, this.game);
            this.item.decode(reader, version);
            if(typeof this.item.base === "string")
                this.item = this.manager.emptyEquipmentItem;
        }
        this.occupiedBy = reader.getString();
    }
}