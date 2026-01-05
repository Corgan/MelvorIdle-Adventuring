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
        this.selectorPopup = undefined;

        this.renderQueue = new AdventuringEquipmentSlotRenderQueue();

        this.component = createElement('adventuring-equipment-slot');

        // Create click-triggered popup for item selection
        this.selectorPopup = tippy(this.component.clickable, {
            content: '',
            allowHTML: true,
            interactive: true,
            trigger: 'click',
            placement: 'bottom',
            maxWidth: 320,
            onShow: (instance) => {
                // Don't show if equipment is locked or slot is occupied
                if(this.equipment.locked || this.occupied) return false;
                instance.setContent(this.buildItemSelectorContent());
            }
        });
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

    /**
     * Build the item selector popup content.
     * Shows all equippable items for this slot type.
     */
    buildItemSelectorContent() {
        const container = document.createElement('div');
        container.className = 'adventuring-item-selector';
        
        // Header
        const header = document.createElement('div');
        header.className = 'text-center font-w600 text-warning border-bottom border-dark pb-1 mb-2';
        header.textContent = this.slotType.name;
        container.appendChild(header);
        
        // Get all items that can go in this slot
        const equippableItems = this.getEquippableItems();
        
        if(equippableItems.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-center text-muted font-size-sm p-2';
            empty.textContent = 'No items available';
            container.appendChild(empty);
            return container;
        }
        
        // Item grid
        const grid = document.createElement('div');
        grid.className = 'd-flex flex-wrap justify-content-center gap-1';
        
        // Add "Unequip" option if slot is not empty
        if(!this.empty) {
            const unequipBtn = document.createElement('div');
            unequipBtn.className = 'adventuring-item-selector-item p-1 pointer-enabled text-center';
            unequipBtn.style.cssText = 'width: 48px; height: 48px; border: 1px solid #444; border-radius: 4px; display: flex; align-items: center; justify-content: center;';
            unequipBtn.innerHTML = '<i class="fa fa-times text-danger"></i>';
            unequipBtn.title = 'Unequip';
            unequipBtn.onclick = () => {
                this.setEmpty();
                this.equipment.character.calculateStats();
                if(this.selectorPopup) this.selectorPopup.hide();
            };
            grid.appendChild(unequipBtn);
        }
        
        // Add each equippable item
        equippableItems.forEach(item => {
            const itemBtn = document.createElement('div');
            itemBtn.className = 'adventuring-item-selector-item p-1 pointer-enabled';
            itemBtn.style.cssText = 'width: 48px; height: 48px; border: 1px solid #444; border-radius: 4px; position: relative;';
            
            // Highlight currently equipped item
            if(this.item === item) {
                itemBtn.style.borderColor = '#28a745';
                itemBtn.style.borderWidth = '2px';
            }
            
            const img = document.createElement('img');
            img.src = item.media;
            img.className = 'w-100 h-100';
            img.style.objectFit = 'contain';
            itemBtn.appendChild(img);
            
            // Show upgrade level
            if(item.upgradeLevel > 0) {
                const level = document.createElement('small');
                level.className = 'position-absolute text-warning font-w700';
                level.style.cssText = 'bottom: 0; right: 2px; font-size: 10px; text-shadow: 1px 1px 1px black;';
                level.textContent = item.level;
                itemBtn.appendChild(level);
            }
            
            itemBtn.title = `${item.name} (Lv ${item.level})`;
            itemBtn.onclick = () => {
                this.equipItem(item);
                if(this.selectorPopup) this.selectorPopup.hide();
            };
            
            grid.appendChild(itemBtn);
        });
        
        container.appendChild(grid);
        return container;
    }
    
    /**
     * Get all items that can be equipped in this slot.
     */
    getEquippableItems() {
        const character = this.equipment.character;
        const combatJob = character.combatJob;
        const passiveJob = character.passiveJob;
        
        return this.manager.baseItems.filter(item => {
            // Skip the "none" item
            if(item.id === 'adventuring:none') return false;
            
            // Must be unlocked and crafted
            if(!item.unlocked || item.upgradeLevel === 0) return false;
            
            // Must fit this slot type
            if(!item.slots.includes(this.slotType)) return false;
            
            // Must be usable by one of the hero's jobs
            if(!item.jobs.includes(combatJob) && !item.jobs.includes(passiveJob)) return false;
            
            // Check paired slot compatibility (e.g., shields with 1h weapons)
            if(item.pairs.length > 0 && this.slotType.pair !== undefined) {
                let pairedSlot = this.slotType.pair;
                let equipmentSlotType = this.manager.itemSlots.getObjectByID(pairedSlot);
                let equipmentSlot = this.equipment.slots.get(equipmentSlotType);
                
                if(!equipmentSlot.empty && !equipmentSlot.occupied && !item.pairs.includes(equipmentSlot.item.type))
                    return false;
            }
            
            return true;
        });
    }
    
    /**
     * Equip an item to this slot, handling occupancy and displaced items.
     */
    equipItem(item) {
        // Handle items being displaced by this equip
        const displacedItems = item.occupies.map(slot => this.equipment.slots.get(slot))
            .filter(slot => !slot.empty && !slot.occupied)
            .map(slot => ({ slot: slot.slotType, item: slot.item }));
        
        // Clear occupied slots
        displacedItems.forEach(({ slot }) => {
            let equipmentSlot = this.equipment.slots.get(slot);
            equipmentSlot.setEmpty();
        });
        
        // Clear current slot
        this.setEmpty();
        
        // Equip the new item
        this.setEquipped(item);
        
        // Recalculate stats
        this.equipment.character.calculateStats();
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