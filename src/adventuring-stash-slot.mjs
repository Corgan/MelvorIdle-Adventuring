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
                //if(this.manager.stash.selectedSlot.empty && this.empty) {
                    this.manager.stash.selectSlot(this);
                /*} else if(!this.manager.stash.selectedSlot.empty && !this.empty) {
                    let swapItemFrom = this.manager.stash.selectedSlot.item;
                    let swapItemTo = this.item;
                    this.manager.stash.selectedSlot.setItem(swapItemTo);
                    this.setItem(swapItemFrom);
                    this.manager.stash.clearSelected();
                } else if(!this.manager.stash.selectedSlot.empty && this.empty) {
                    this.setItem(this.manager.stash.selectedSlot.item);
                    this.manager.stash.selectedSlot.setEmpty();
                    this.manager.stash.clearSelected();
                } else if(this.manager.stash.selectedSlot.empty && !this.empty) {
                    this.manager.stash.selectedSlot.setItem(this.item);
                    this.setEmpty();
                    this.manager.stash.clearSelected();
                }
                */
            }
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) {
                if(this.empty) {
                    this.setItem(selectedEquipment.selectedSlot.item);
                    selectedEquipment.selectedSlot.setEmpty();
                    selectedEquipment.clearSelected();
                } else {
                    let fromItem = selectedEquipment.selectedSlot.item;
                    let toItem = this.item;

                    if(toItem.validSlots.includes(selectedEquipment.selectedSlot.slot)) {
                        selectedEquipment.selectedSlot.setEquipped(toItem);
                        this.setItem(fromItem);
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