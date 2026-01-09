const { loadModule } = mod.getContext(import.meta);

const { AdventuringEquipmentSlotElement } = await loadModule('src/items/components/adventuring-equipment-slot.mjs');
const { createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringIconButtonElement } = await loadModule('src/ui/components/adventuring-icon-button.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

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
        this.selectorPopup = createTooltip(this.component.clickable, '', {
            interactive: true,
            trigger: 'click',
            placement: 'bottom',
            maxWidth: 320,
            onShow: (instance) => {
                // Don't show if actively exploring a dungeon or slot is occupied
                if(this.manager.isActive || this.occupied) return false;
                instance.setContent(this.buildItemSelectorContent());
            }
        });
    }

    /**
     * Cleanup resources (call when equipment slot is destroyed)
     */
    destroy() {
        if(this.selectorPopup) {
            this.selectorPopup.destroy();
            this.selectorPopup = undefined;
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
        
        // === ARTIFACT RESTRICTION ===
        // Only ONE artifact can be equipped per character
        if(item.isArtifact) {
            // Check if another artifact is already equipped (excluding this slot)
            for(const [slotType, slot] of this.equipment.slots) {
                if(slot === this) continue; // Skip current slot
                if(slot.occupied) continue; // Skip occupied slots
                if(slot.item && slot.item.isArtifact && slot.item !== item) {
                    return false; // Another artifact is already equipped
                }
            }
        }
        
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
        const character = this.equipment.character;
        
        // Header
        const header = document.createElement('div');
        header.className = 'text-center font-w600 text-warning border-bottom border-dark pb-1 mb-2';
        header.textContent = this.slotType.name;
        container.appendChild(header);
        
        // Get all items that can go in this slot
        const equippableItems = this.getEquippableItems();
        
        if(equippableItems.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setMessage('No items available', 'p-2 font-size-sm');
            container.appendChild(empty);
            return container;
        }
        
        // Item grid
        const grid = document.createElement('div');
        grid.className = 'd-flex flex-wrap justify-content-center';
        
        // Add "Unequip" option if slot is not empty
        if(!this.empty) {
            const unequipBtn = new AdventuringIconButtonElement();
            unequipBtn.setIcon({
                borderClass: 'border-danger',
                tooltipContent: '<div class="p-1">Unequip</div>',
                onClick: () => {
                    const previousItem = this.item;
                    this.setEmpty();
                    if (this.equipment.character.invalidateStats) this.equipment.character.invalidateStats();
                    this.equipment.character.calculateStats();
                    this.manager.emit('equipment:changed', { 
                        hero: this.equipment.character, 
                        slot: this.slotType, 
                        item: null,
                        previousItem 
                    });
                    if(this.selectorPopup) this.selectorPopup.hide();
                }
            });
            unequipBtn.setCustomContent('<i class="fa fa-times text-danger"></i>');
            grid.appendChild(unequipBtn);
        }
        
        // Add each equippable item
        equippableItems.forEach(item => {
            const isEquipped = this.item === item;
            const otherCharacterSlot = item.currentSlot && item.currentSlot.equipment.character !== character ? item.currentSlot : null;
            
            let borderClass = 'border-secondary';
            if(isEquipped) {
                borderClass = 'border-success';
            } else if(otherCharacterSlot) {
                borderClass = 'border-warning';
            }
            
            const iconBtn = new AdventuringIconButtonElement();
            iconBtn.setIcon({
                icon: item.media,
                borderClass,
                bottomBadgeText: item.upgradeLevel > 0 ? item.level : undefined,
                bottomBadgeClass: 'bg-secondary',
                tooltipContent: TooltipBuilder.forEquipment(item, this.manager, character).build(),
                onClick: () => {
                    this.equipItem(item);
                    if(this.selectorPopup) this.selectorPopup.hide();
                }
            });
            
            // Add hover effect to highlight slot on other character if equipped there
            if(otherCharacterSlot) {
                iconBtn.container.onmouseenter = () => {
                    otherCharacterSlot.component.border.classList.add('border-warning');
                    otherCharacterSlot.component.border.classList.remove('border-secondary');
                };
                iconBtn.container.onmouseleave = () => {
                    otherCharacterSlot.component.border.classList.remove('border-warning');
                    otherCharacterSlot.component.border.classList.add('border-secondary');
                };
            }
            
            grid.appendChild(iconBtn);
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
        
        // Check if an artifact is already equipped in another slot
        let hasEquippedArtifact = false;
        let equippedArtifact = null;
        for(const [slotType, slot] of this.equipment.slots) {
            if(slot === this) continue;
            if(slot.occupied) continue;
            if(slot.item && slot.item.isArtifact) {
                hasEquippedArtifact = true;
                equippedArtifact = slot.item;
                break;
            }
        }
        
        return this.manager.baseItems.filter(item => {
            // Skip the "none" item
            if(item.id === 'adventuring:none') return false;
            
            // Must be unlocked and crafted
            if(!item.unlocked || item.upgradeLevel === 0) return false;
            
            // Must fit this slot type
            if(!item.slots.includes(this.slotType)) return false;
            
            // Must be usable by one of the hero's jobs
            if(!item.jobs.includes(combatJob) && !item.jobs.includes(passiveJob)) return false;
            
            // === ARTIFACT RESTRICTION ===
            // If this is an artifact and another artifact is equipped, block it
            // (unless it's the same artifact equipped in this slot)
            if(item.isArtifact && hasEquippedArtifact && item !== equippedArtifact) {
                return false;
            }
            
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
        // If item is equipped on another character, unequip it first
        const existingSlot = item.currentSlot;
        if(existingSlot && existingSlot.equipment.character !== this.equipment.character) {
            existingSlot.setEmpty();
            if (existingSlot.equipment.character.invalidateStats) existingSlot.equipment.character.invalidateStats();
            existingSlot.equipment.character.calculateStats();
        }
        
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
        if (this.equipment.character.invalidateStats) this.equipment.character.invalidateStats();
        this.equipment.character.calculateStats();
        
        // Emit equipment changed event
        this.manager.emit('equipment:changed', { 
            hero: this.equipment.character, 
            slot: this.slotType, 
            item: item,
            displaced: displacedItems 
        });
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
        const character = this.equipment.character;
        if(!this.empty) {
            if(this.occupied) {
                let occupiedSlot = this.equipment.slots.get(this.occupiedBy);
                media = occupiedSlot.item.media;
                tooltip = TooltipBuilder.forEquipment(occupiedSlot.item, this.manager, character).build();
            } else {
                media = this.item.media;
                tooltip = TooltipBuilder.forEquipment(this.item, this.manager, character).build();
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