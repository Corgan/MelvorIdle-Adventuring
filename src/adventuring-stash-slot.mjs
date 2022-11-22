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

        this.component = new AdventuringStashSlotUIComponent(this.manager, this.game, this);
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
            if(this.manager.stash.selectedSlot === this || this.empty)  {
                this.manager.stash.clearSelected();
            } else {
                this.manager.stash.selectSlot(this);
            }
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) {
                if(this.empty) {
                    let newItem = selectedEquipment.selectedSlot.item;
                    let newOccupiedSlots = newItem.occupies.map(slot => selectedEquipment.slots.get(slot)).filter(slot => !slot.empty && slot.occupied)
                    
                    this.setItem(newItem);
                    newOccupiedSlots.forEach(slot => {
                        slot.setEmpty();
                    });
                    selectedEquipment.selectedSlot.setEmpty();
                    selectedEquipment.clearSelected();
                } else {
                    let newItem = selectedEquipment.selectedSlot.item;
                    let oldItem = this.item;

                    let newOccupiedSlots = newItem.occupies.map(slot => selectedEquipment.slots.get(slot)).filter(slot => !slot.empty && slot.occupied);

                    let oldEquippedSlotItems = oldItem.occupies.map(slot => selectedEquipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => ({ slot: slot.slotType, item: slot.item }));

                    if(this.manager.stash.emptyCount < oldEquippedSlotItems.length) {
                        imageNotify(cdnMedia('assets/media/main/bank_header.svg'), "Your stash is full.", 'danger');
                        return;
                    }

                    if(selectedEquipment.selectedSlot.canEquip(oldItem)) {
                        newOccupiedSlots.forEach(slot => {
                            slot.setEmpty();
                        });

                        selectedEquipment.selectedSlot.setEquipped(oldItem);
                        this.setItem(newItem);

                        oldEquippedSlotItems.forEach(({ slot, item }) => {
                            this.manager.stash.firstEmpty.setItem(item);
                        });
                        selectedEquipment.clearSelected();
                    }
                }
            } else {
                if(!this.empty)
                    this.manager.stash.selectSlot(this);
            }

            this.manager.party.all.forEach(member => member.calculateStats());
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

        //cdnMedia('assets/media/bank/passive_slot.png')
        this.component.icon.src = this.empty ? mod.getContext(this.manager.namespace).getResourceUrl('assets/media/empty.png') : this.item.media;
        this.component.tooltip.setContent(this.empty ? "Empty" : this.item.tooltip);

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
            if(typeof this.item.base === "string")
                this.item = this.manager.emptyEquipmentItem;
        }
    }
}