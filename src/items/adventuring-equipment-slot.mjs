const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentSlotElement } = await loadModule('src/items/components/adventuring-equipment-slot.mjs');

class AdventuringEquipmentSlotRenderQueue {
    constructor() {
        this.icon = false;
        this.highlight = false;
        this.upgrade = false;
        this.selected = false;
        this.clickable = false;
    }
    queueAll() {
        this.icon = true;
        this.highlight = true;
        this.upgrade = true;
        this.selected = true;
        this.clickable = true;
    }
    updateAll() {
        this.queueAll();
    }
}

export class AdventuringEquipmentSlot {
    constructor(manager, game, equipment, slotType) {
        this.game = game;
        this.manager = manager;
        this.equipment = equipment;
        this.slotType = slotType;
        this.occupiedBy = this.manager.cached.noneItemSlot;
        this.item = this.manager.cached.noneItem;
        this.highlight = false;
        this.clickable = false;
        this.selected = false;

        this.renderQueue = new AdventuringEquipmentSlotRenderQueue();

        this.component = createElement('adventuring-equipment-slot');

        this.component.clickable.onclick = () => {
            this.slotClicked();
        }
    }

    onLoad() {
        this.renderQueue.icon = true;
        this.renderQueue.highlight = true;
        this.renderQueue.upgrade = true;
        this.renderQueue.clickable = true;
        this.renderQueue.valid = true;
    }

    canEquip(item, swapSlot) {
        if(item === undefined)
            return false;
        if(item === this.manager.cached.noneItem)
            return true;
        if(!item.unlocked || item.upgradeLevel === 0)
            return false;
        if(!item.slots.includes(this.slotType))
            return false;
        if(!item.jobs.includes(this.equipment.character.combatJob) && !item.jobs.includes(this.equipment.character.passiveJob))
            return false;
        if(item.pairs.length > 0) {
            if(this.slotType.pair !== undefined) {
                let pairedSlot = this.slotType.pair;
                let equipmentSlotType = this.manager.itemSlots.getObjectByID(pairedSlot);
                let equipmentSlot = this.equipment.slots.get(equipmentSlotType);

                if(!equipmentSlot.empty && !equipmentSlot.occupied && !item.pairs.includes(equipmentSlot.item.type))
                    return false;
            }
        }
        //if(swapSlot && !this.empty && !this.item.slots.includes(swapSlot.slotType))
        //    return false;
        if(swapSlot !== undefined && !swapSlot.canEquip(this.item))
            return false;
        return true;
    }

    slotClicked() {
        if(!this.manager.armory.active)
            return;
        
        if(this.manager.armory.selectedItem !== undefined) {
            if(this.manager.armory.selectedItem === this) {
                this.manager.armory.clearSelected();
            } else {
                let swapSlot = this.manager.armory.selectedItem.currentSlot;

                let newItem = this.manager.armory.selectedItem;
                let oldItem = this.item;

                let newEquippedSlotItems = newItem.occupies.map(slot => this.equipment.slots.get(slot))
                    .filter(slot => !slot.empty && !slot.occupied).map(slot => ({ slot: slot.slotType, item: slot.item }));

                let oldEquippedSlotItems = [];
                if(swapSlot !== undefined) {
                    oldEquippedSlotItems = oldItem.occupies.map(slot => swapSlot.equipment.slots.get(slot))
                        .filter(slot => !slot.empty && !slot.occupied).map(slot => ({ slot: slot.slotType, item: slot.item }));
                }

                if(this.canEquip(newItem)) {
                    oldEquippedSlotItems.forEach(({ slot, item }) => {
                        let equipmentSlot = swapSlot.equipment.slots.get(slot);
                        equipmentSlot.setEmpty();
                    });

                    newEquippedSlotItems.forEach(({ slot, item }) => {
                        let equipmentSlot = this.equipment.slots.get(slot);
                        equipmentSlot.setEmpty();
                    });
                    this.setEmpty();
                    if(swapSlot !== undefined)
                        swapSlot.setEmpty();

                    
                    this.setEquipped(newItem);

                    if(swapSlot !== undefined) {
                        if(swapSlot.canEquip(oldItem))
                            swapSlot.setEquipped(oldItem);
                    }

                    oldEquippedSlotItems.forEach(({ slot, item }) => {
                        let equipmentSlot = swapSlot.equipment.slots.get(slot);

                        if(equipmentSlot.canEquip(item))
                            equipmentSlot.setEquipped(item);
                    });

                    newEquippedSlotItems.forEach(({ slot, item }) => {
                        let equipmentSlot = this.equipment.slots.get(slot);

                        if(equipmentSlot.canEquip(item))
                            equipmentSlot.setEquipped(item);
                    });

                    this.manager.armory.clearSelected();
                } else {
                    if(!this.empty && !this.occupied) {
                        this.manager.armory.clearSelected();
                        this.manager.armory.selectItem(this.item);
                    }
                }
            }
        } else {
            if(!this.empty && !this.occupied) {
                this.manager.armory.selectItem(this.item);
            }
        }

        this.manager.party.all.forEach(member => member.calculateStats());
    }

    setOccupied(slot) {
        this.item.renderQueue.equipped = true;

        this.item = this.manager.cached.noneItem;
        this.occupiedBy = slot;
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
        this.renderQueue.upgrade = true;
    }

    setEquipped(item) {
        this.item.renderQueue.equipped = true;
        this.item.occupies.forEach(slot => {
            let equipmentSlot = this.equipment.slots.get(slot);
            equipmentSlot.setEmpty();
        });

        this.item = item;
        this.item.renderQueue.equipped = true;
        this.occupiedBy = this.manager.cached.noneItemSlot;
        this.item.occupies.forEach(slot => {
            let equipmentSlot = this.equipment.slots.get(slot);
            equipmentSlot.setOccupied(this.slotType);
        });
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
        this.renderQueue.upgrade = true;
        
        // Invalidate effect cache
        if(this.equipment.character && this.equipment.character.effectCache) {
            this.equipment.character.invalidateEffects('equipment');
        }
    }

    setEmpty() {
        this.item.renderQueue.equipped = true;
        this.item.occupies.forEach(slot => {
            let equipmentSlot = this.equipment.slots.get(slot);
            equipmentSlot.setEmpty();
        });

        this.item = this.manager.cached.noneItem;
        this.occupiedBy = this.manager.cached.noneItemSlot;
        this.renderQueue.icon = true;
        this.renderQueue.valid = true;
        this.renderQueue.upgrade = true;
        
        // Invalidate effect cache
        if(this.equipment.character && this.equipment.character.effectCache) {
            this.equipment.character.invalidateEffects('equipment');
        }
    }

    get empty() {
        return this.item === this.manager.cached.noneItem && !this.occupied;
    }

    get occupied() {
        return this.occupiedBy !== this.manager.cached.noneItemSlot;
    }
    
    get stats() {
        return this.item.stats;
    }

    setSelected(selected) {
        this.selected = selected;
        this.renderQueue.selected = true;
        this.renderQueue.highlight = true;
        this.renderQueue.upgrade = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
        this.renderQueue.selected = true;
        this.renderQueue.upgrade = true;
    }

    setClickable(clickable) {
        this.clickable = clickable;
        this.renderQueue.clickable = true;
        this.renderQueue.upgrade = true;
    }

    render() {
        this.renderIcon();
        this.renderValid();
        this.renderHighlight();
        this.renderUpgrade();
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
            media = this.slotType.media;
            tooltip = this.slotType.name;
        }

        this.component.icon.src = media;
        this.component.icon.classList.toggle('opacity-40', !this.empty && this.occupied);

        this.component.setTooltipContent(tooltip);

        this.renderQueue.icon = false;
    }

    renderValid() {
        if(!this.renderQueue.valid)
            return;

        this.component.border.classList.toggle('border-danger', !this.canEquip(this.item));

        this.renderQueue.valid = false;
    }

    renderSelected() {
        if(!this.renderQueue.selected)
            return;

        this.component.border.classList.toggle('border-success', this.selected);

        this.renderQueue.selected = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.border.classList.toggle('border-warning', this.highlight && !this.selected);

        this.renderQueue.highlight = false;
    }

    renderUpgrade() {
        if(!this.renderQueue.upgrade)
            return;

        this.component.upgrade.classList.toggle('d-none', this.empty || this.occupied || this.item.upgradeLevel === 0);
        this.component.upgrade.textContent = this.item !== undefined ? this.item.level : 0;

        this.renderQueue.upgrade = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.clickable.classList.toggle('pointer-enabled', this.clickable);

        this.renderQueue.clickable = false;
    }

    encode(writer) {
        writer.writeNamespacedObject(this.item);
        writer.writeNamespacedObject(this.occupiedBy);
        return writer;
    }

    decode(reader, version) {
        this.item = reader.getNamespacedObject(this.manager.baseItems);
        if(typeof this.item === "string")
            this.item = this.manager.baseItems.getObjectByID("adventuring:none");
        
        this.occupiedBy = reader.getNamespacedObject(this.manager.itemSlots);
        if(typeof this.occupiedBy === "string")
            this.occupiedBy = this.manager.itemSlots.getObjectByID("adventuring:none");
    }
}