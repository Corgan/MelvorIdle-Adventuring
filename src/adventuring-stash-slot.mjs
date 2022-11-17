const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');

const { AdventuringStashSlotUIComponent } = await loadModule('src/components/adventuring-stash-slot.mjs');

class AdventuringStashSlotRenderQueue {
    constructor() {
        this.icon = false;
        this.selected = false;
    }
}

export class AdventuringStashSlot {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.item = this.manager.emptyEquipmentItem;
        this.selected = false;

        this.renderQueue = new AdventuringStashSlotRenderQueue();

        this.component = new AdventuringStashSlotUIComponent(this.manager, this.game);
        this.component.icon.onclick = () => {
            this.slotClicked();
        }
    }

    onLoad() {
        this.renderQueue.icon = true;
        this.renderQueue.selected = true;
    }

    slotClicked() {
        if(this.manager.pages.active !== this.manager.stash)
            return;
        
        if(this.manager.stash.selectedSlot !== undefined) {
            if(this.manager.stash.selectedSlot === this)  {
                this.manager.stash.clearSelected();
            } else {
                this.manager.stash.selectSlot(this);
            }
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) {
                if(this.empty) {
                    let newItem = selectedEquipment.selectedSlot.item;
                    let occupiedSlots = newItem.occupies.map(slot => selectedEquipment.slots.get(slot)).filter(slot => !slot.empty && slot.occupied)
                    
                    this.setItem(newItem);
                    occupiedSlots.forEach(slot => {
                        slot.setEmpty();
                    });
                    selectedEquipment.selectedSlot.setEmpty();
                    selectedEquipment.clearSelected();
                } else {
                    let newItem = selectedEquipment.selectedSlot.item;
                    let oldItem = this.item;

                    let newOccupiedItems = newItem.occupies.map(slot => selectedEquipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => slot.item);

                    let oldOccupiedItems = oldItem.occupies.map(slot => selectedEquipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => slot.item);

                    if(this.manager.stash.emptyCount < oldOccupiedItems.length) {
                        imageNotify(cdnMedia('assets/media/main/bank_header.svg'), "Your stash is full.", 'danger');
                        return;
                    }

                    if(selectedEquipment.selectedSlot.canEquip(oldItem)) {
                        selectedEquipment.selectedSlot.setEquipped(oldItem);
                        this.setItem(newItem);

                        oldOccupiedItems.forEach(item => {
                            this.manager.stash.firstEmpty.setItem(item);
                        });
                        selectedEquipment.clearSelected();
                    }
                }
            } else {
                this.manager.stash.selectSlot(this);
            }

            this.manager.party.all.forEach(member => member.calculateLevels());
        }
    }

    setItem(item) {
        this.item = item;
        this.renderQueue.icon = true;
    }

    setEmpty() {
        this.item = this.manager.emptyEquipmentItem;
        this.renderQueue.icon = true;
    }

    setSelected(selected) {
        this.selected = selected;
        this.renderQueue.selected = true;
    }

    get empty() {
        return this.item === this.manager.emptyEquipmentItem;
    }

    render() {
        this.renderItem();
        this.renderSelected();
    }

    renderItem() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.empty ? cdnMedia('assets/media/bank/passive_slot.png') : this.item.media;
        this.component.tooltip.setContent(!this.empty ? this.item.tooltip : "Empty");

        this.renderQueue.icon = false;
    }

    renderSelected() {
        if(!this.renderQueue.selected)
            return;

        this.component.icon.classList.toggle('border-success', this.selected);

        this.renderQueue.selected = false;
    }

    encode(writer) {
        writer.writeBoolean(!this.empty)
        if(!this.empty) {
            this.item.encode(writer);
        }
        return writer;
    }

    decode(reader, version) {
        if(reader.getBoolean()) {
            this.item = new AdventuringEquipmentItem(this.manager, this.game);
            this.item.decode(reader, version);
        }
    }
}