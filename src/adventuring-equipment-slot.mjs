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
    }

    slotClicked() {
        if(this.manager.pages.active !== this.manager.stash)
            return;
        
        if(this.manager.stash.selectedSlot !== undefined) {
            let fromItem = this.manager.stash.selectedSlot.item;
            let toItem = this.item;
            if(fromItem.validSlots.includes(this.slot)) {
                this.setEquipped(fromItem);
                this.manager.stash.selectedSlot.setItem(toItem);
                this.manager.stash.clearSelected();
            }
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) {
                if(selectedEquipment.selectedSlot === this) {
                    selectedEquipment.clearSelected();
                } else {
                    let swapItemFrom = selectedEquipment.selectedSlot.item;
                    let swapItemTo = this.item;

                    if(swapItemFrom.validSlots.includes(this.slot)) {
                        this.setEquipped(swapItemFrom);
                        selectedEquipment.selectedSlot.setEquipped(swapItemTo);
                        selectedEquipment.clearSelected();
                    } else {
                        if(!this.empty) {
                            this.equipment.selectSlot(this);
                        }
                    }
                }
            } else {
                if(!this.empty) {
                    this.equipment.selectSlot(this);
                }
            }
        }

        this.manager.party.all.forEach(member => member.calculateLevels());
    }

    setOccupied(item, slot) {
        this.occupiedBy = slot;
        this.renderQueue.icon = true;
    }

    setEquipped(item) {
        this.item = item;
        this.occupiedBy = 'None';
        this.renderQueue.icon = true;
    }

    setEmpty() {
        this.item = this.manager.emptyEquipmentItem;
        this.occupiedBy = 'None';
        this.renderQueue.icon = true;
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
        this.renderHighlight();
        this.renderSelected();
        this.renderClickable();
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = !this.empty ? this.item.media : cdnMedia(`assets/media/bank/${equipmentSlotData[this.slot].emptyMedia}.png`);
        this.component.tooltip.setContent(!this.empty ? this.item.tooltip : "Empty");

        this.renderQueue.icon = false;
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
        writer.writeBoolean(!this.empty)
        if(!this.empty) {
            this.item.encode(writer);
        }
        writer.writeString(this.occupiedBy);
        return writer;
    }

    decode(reader, version) {
        if(reader.getBoolean()) {
            this.item = new AdventuringEquipmentItem(this.manager, this.game);
            this.item.decode(reader, version);
        }
        reader.getString(this.occupiedBy);
    }
}