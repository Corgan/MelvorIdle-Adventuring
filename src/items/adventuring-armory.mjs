const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

// Side-effect imports to register custom elements and load dependencies
await loadModule('src/items/adventuring-equipment.mjs');
await loadModule('src/items/components/adventuring-armory.mjs');
await loadModule('src/items/components/adventuring-material.mjs');

class AdventuringArmoryRenderQueue {
    constructor(){
        this.details = false;
    }
    queueAll() {
        this.details = true;
    }
}

export class AdventuringArmory extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.upgradeLevels = new Map();
        this.itemsBySlot = new Map();
        this.itemsByCategory = new Map(); // Category -> Array of slots
        this.unlocked = new Map();
        this.viewed = new Map();  // Track if item has been viewed in UI
        this.masterfulItems = new Map();  // Track Masterful rank items
        this.droppedItems = new Map();  // Track items unlocked via loot/drop system
        this.artifactTiers = new Map();  // Track artifact prestige tiers (0, 1, 2)
        this.activeCategory = 'melee'; // Currently selected category

        this.component = createElement('adventuring-armory');
        this.renderQueue = new AdventuringArmoryRenderQueue();

        this.base = new AdventuringStats(this.manager, this.game);
        this.base.component.mount(this.component.base);

        this.scaling = new AdventuringStats(this.manager, this.game);
        this.scaling.component.mount(this.component.scaling);

        this.materialComponents = [];

        this.component.upgradeButton.onclick = () => this.upgradeSelected();
        this.component.back.onclick = () => this.back();
        
        // Category dropdown names for display
        this.categoryNames = {
            melee: 'Melee',
            ranged: 'Ranged',
            magic: 'Magic',
            offhands: 'Offhands',
            heavy: 'Heavy Armor',
            medium: 'Medium Armor',
            light: 'Light Armor',
            accessories: 'Accessories'
        };
        
        // Dropdown option click handlers
        this.component.optionMelee.onclick = () => this.setCategory('melee');
        this.component.optionRanged.onclick = () => this.setCategory('ranged');
        this.component.optionMagic.onclick = () => this.setCategory('magic');
        this.component.optionOffhands.onclick = () => this.setCategory('offhands');
        this.component.optionHeavy.onclick = () => this.setCategory('heavy');
        this.component.optionMedium.onclick = () => this.setCategory('medium');
        this.component.optionLight.onclick = () => this.setCategory('light');
        this.component.optionAccessories.onclick = () => this.setCategory('accessories');
    }

    /**
     * Map item type IDs to categories
     */
    getItemCategory(baseItem) {
        if(!baseItem.type) return 'melee';
        const typeId = baseItem.type.id;
        
        // Melee weapons
        const meleeTypes = ['adventuring:dagger', 'adventuring:sword1h', 'adventuring:sword2h', 'adventuring:axe', 'adventuring:scimitar'];
        if(meleeTypes.includes(typeId)) return 'melee';
        
        // Ranged weapons
        const rangedTypes = ['adventuring:knives', 'adventuring:javelin', 'adventuring:crossbow', 'adventuring:shortbow', 'adventuring:longbow'];
        if(rangedTypes.includes(typeId)) return 'ranged';
        
        // Magic weapons
        const magicTypes = ['adventuring:wand', 'adventuring:staff'];
        if(magicTypes.includes(typeId)) return 'magic';
        
        // Offhands
        const offhandTypes = ['adventuring:quiver', 'adventuring:spellbook', 'adventuring:buckler', 'adventuring:shield'];
        if(offhandTypes.includes(typeId)) return 'offhands';
        
        // Heavy armor (melee)
        const heavyTypes = ['adventuring:helm', 'adventuring:platebody', 'adventuring:platelegs', 'adventuring:gauntlets', 'adventuring:sabatons'];
        if(heavyTypes.includes(typeId)) return 'heavy';
        
        // Medium armor (ranged)
        const mediumTypes = ['adventuring:cowl', 'adventuring:vest', 'adventuring:chaps', 'adventuring:vambraces', 'adventuring:boots'];
        if(mediumTypes.includes(typeId)) return 'medium';
        
        // Light armor (mage)
        const lightTypes = ['adventuring:hat', 'adventuring:robes', 'adventuring:bottoms', 'adventuring:mitts', 'adventuring:slippers'];
        if(lightTypes.includes(typeId)) return 'light';
        
        // Accessories
        const accessoryTypes = ['adventuring:amulet', 'adventuring:ring', 'adventuring:cape'];
        if(accessoryTypes.includes(typeId)) return 'accessories';
        
        return 'melee'; // Default
    }

    /**
     * Switch to a different category
     */
    setCategory(category) {
        this.activeCategory = category;
        
        // Update dropdown button text
        this.component.categoryDropdownButton.textContent = this.categoryNames[category] || category;
        
        // Re-render items for the selected category
        this.renderCategoryItems();
    }

    /**
     * Render items for the current category
     */
    renderCategoryItems() {
        this.component.items.replaceChildren();
        
        // Get items for this category
        const categoryItems = this.manager.baseItems.filter(item => 
            item.id !== 'adventuring:none' && this.getItemCategory(item) === this.activeCategory
        );
        
        // Group by item type name for display
        const typeGroups = new Map();
        categoryItems.forEach(item => {
            const typeName = item.type ? item.type.name : 'Other';
            if(!typeGroups.has(typeName)) {
                typeGroups.set(typeName, []);
            }
            typeGroups.get(typeName).push(item);
        });
        
        // Render each type group
        typeGroups.forEach((items, typeName) => {
            if(items.length > 0) {
                this.component.items.appendChild(createElement('div', { className: 'p-1 w-100 font-w600 text-warning', text: typeName }));
                items.forEach(baseItem => {
                    baseItem.component.mount(this.component.items);
                    // Re-trigger tooltip render after mounting since tippy is recreated
                    baseItem.renderQueue.tooltip = true;
                });
            }
        });
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.details = true;
        this.checkUnlocked();
    }

    onShow() {
        this.manager.party.all.forEach(member => {
            member.setLocked(false);
            member.equipment.setLocked(false);
        });
        // Refresh current category display
        this.renderCategoryItems();
        // Mark all visible unlocked items as viewed
        this.markAllViewed();
    }

    onHide() {
        super.onHide();
        this.clearSelected();

        this.manager.party.all.forEach(member => {
            member.setLocked(true);
            member.equipment.setLocked(true);
        });
    }

    postDataRegistration() {
        this.manager.baseItems.forEach(baseItem => {
            if(baseItem.id !== "adventuring:none") {
                this.upgradeLevels.set(baseItem, 0);
                if(baseItem.slots !== undefined && baseItem.slots.length > 0) {
                    let slot = baseItem.slots[0];
                    let existingItems = this.itemsBySlot.get(slot);
                    if(existingItems === undefined)
                        existingItems = [];
                    existingItems.push(baseItem);
                    this.itemsBySlot.set(slot, existingItems);
                }
            }
        });

        // Initial render of the default category (weapons)
        this.renderCategoryItems();
    }

    checkUnlocked() {
        this.upgradeLevels.forEach((level, baseItem) => {
            // Skip if already unlocked
            if(this.unlocked.get(baseItem) === true) return;
            
            // Check if requirements are met (skill level, achievements, etc.)
            if(baseItem.requirementsMet) {
                this.unlock(baseItem);
                baseItem.renderQueue.updateAll();
            }
        });
    }

    unlock(item) {
        this.unlocked.set(item, true);
        // When unlocked, item becomes usable (upgradeLevel 1)
        if (this.upgradeLevels.get(item) < 1) {
            this.upgradeLevels.set(item, 1);
        }
        item.renderQueue.updateAll();
        this.renderQueue.details = true;
    }

    /**
     * Mark an item as dropped (unlocked via loot system).
     * This satisfies the 'dropped' requirement type.
     * @param {AdventuringItemBase} item - The item to mark as dropped
     * @param {boolean} notify - Whether to show a notification (default true)
     * @param {string} rarity - Rarity tier for notification styling (optional)
     */
    markDropped(item, notify = true, rarity = null) {
        if (this.droppedItems.get(item) === true) return; // Already dropped
        
        this.droppedItems.set(item, true);
        item.renderQueue.updateAll();
        
        if (notify) {
            // Determine rarity from item or parameter
            const itemRarity = rarity || item.rarity || 'common';
            const message = this.getDropMessage(item.name, itemRarity);
            const logType = this.getLogTypeForRarity(itemRarity);
            this.manager.log.add(message, logType, item.media);
        }
        
        // Trigger unlock check since dropped items may now meet requirements
        this.checkUnlocked();
    }
    
    /**
     * Get notification message based on rarity
     * @param {string} name - Item name
     * @param {string} rarity - Rarity tier
     * @returns {string} Formatted message
     */
    getDropMessage(name, rarity) {
        switch(rarity) {
            case 'legendary':
                return `★★★ LEGENDARY: ${name}! ★★★`;
            case 'epic':
                return `★★ Epic Drop: ${name}! ★★`;
            case 'rare':
                return `★ Rare: ${name}!`;
            case 'uncommon':
                return `Found ${name}!`;
            default:
                return `Found ${name}!`;
        }
    }
    
    /**
     * Get log type (affects styling) based on rarity
     * @param {string} rarity - Rarity tier
     * @returns {string} Log message type
     */
    getLogTypeForRarity(rarity) {
        switch(rarity) {
            case 'legendary':
                return 'legendary';
            case 'epic':
                return 'epic';
            case 'rare':
                return 'rare';
            default:
                return 'info';
        }
    }

    /**
     * Pre-craft an item by unlocking it and setting upgrade level to 1.
     * Used for starter gear that heroes begin with.
     * @param {string} itemId - The full item ID (e.g. 'adventuring:bronze_sword1h')
     * @returns {AdventuringItemBase|null} The pre-crafted item, or null if not found
     */
    preCraftItem(itemId) {
        const item = this.manager.baseItems.getObjectByID(itemId);
        if(!item) {
            console.warn(`[Adventuring] Could not pre-craft item: ${itemId}`);
            return null;
        }
        
        // Unlock and set to level 1
        this.unlocked.set(item, true);
        this.upgradeLevels.set(item, 1);
        this.viewed.set(item, true); // Don't show as NEW
        item.renderQueue.updateAll();
        
        return item;
    }

    /**
     * Mark an item as viewed in the UI (removes NEW badge)
     */
    markViewed(item) {
        if(this.unlocked.get(item) && !this.viewed.get(item)) {
            this.viewed.set(item, true);
            item.renderQueue.updateAll();
        }
    }

    /**
     * Mark all unlocked items as viewed
     */
    markAllViewed() {
        this.unlocked.forEach((unlocked, item) => {
            if(unlocked && !this.viewed.get(item)) {
                this.viewed.set(item, true);
                item.renderQueue.updateAll();
            }
        });
    }

    /**
     * Check if an item is new (unlocked but not viewed)
     */
    isNew(item) {
        return this.unlocked.get(item) === true && this.viewed.get(item) !== true;
    }

    /**
     * Count how many items are new
     */
    getNewCount() {
        let count = 0;
        this.unlocked.forEach((unlocked, item) => {
            if(unlocked && !this.viewed.get(item)) count++;
        });
        return count;
    }

    upgradeSelected() {
        if(this.selectedItem !== undefined) {
            this.upgrade(this.selectedItem);
            this.updateSelectHighlight()
        }
    }

    upgrade(item) {
        if(item.upgradeable) {
            // Deduct base materials
            for(let material of item.materials.keys()) {
                this.manager.stash.remove(material, item.getCost(material));
            }
            
            // Deduct tiered upgrade materials (higher upgrade levels need later-game materials)
            const tieredMats = item.getUpgradeTierMaterials();
            for (const material of tieredMats) {
                const cost = item.getUpgradeTierCost(material);
                this.manager.stash.remove(material, cost);
            }
            
            this.upgradeLevels.set(item, this.upgradeLevels.get(item) + 1);
            item.renderQueue.updateAll();
            if(item.currentSlot !== undefined)
                item.currentSlot.renderQueue.updateAll();
        }
        this.renderQueue.details = true;
    }
    
    /**
     * Check if an item can be upgraded to Masterful rank
     * Requires: max upgrade level (10), level 99 mastery, and gauntlet tokens
     */
    canUpgradeToMasterful(item) {
        if (this.masterfulItems.get(item)) return false; // Already masterful
        if (this.upgradeLevels.get(item) < item.maxUpgrades) return false; // Not max upgrade
        if (item.level < 99) return false; // Not max mastery level
        
        // Check gauntlet token requirements
        const tokenCosts = this.getMasterfulTokenCost(item);
        for (const [tokenId, cost] of Object.entries(tokenCosts)) {
            const token = this.manager.materials.getObjectByID(tokenId);
            if (!token) return false;
            const available = this.manager.stash.materialCounts.get(token) || 0;
            if (available < cost) return false;
        }
        
        return true;
    }
    
    /**
     * Get the gauntlet token cost for masterful upgrade
     */
    getMasterfulTokenCost(item) {
        // Tier scales with item tier
        const tier = item.tier || 1;
        const baseCost = Math.max(1, Math.floor(tier / 3));
        
        return {
            'adventuring:gauntlet_token': baseCost,
            'adventuring:gauntlet_token_ii': baseCost,
            'adventuring:gauntlet_token_iii': baseCost
        };
    }
    
    /**
     * Upgrade an item to Masterful rank
     */
    upgradeToMasterful(item) {
        if (!this.canUpgradeToMasterful(item)) return false;
        
        // Deduct gauntlet tokens
        const tokenCosts = this.getMasterfulTokenCost(item);
        for (const [tokenId, cost] of Object.entries(tokenCosts)) {
            const token = this.manager.materials.getObjectByID(tokenId);
            if (token) {
                this.manager.stash.remove(token, cost);
            }
        }
        
        // Mark as masterful
        this.masterfulItems.set(item, true);
        item.calculateStats();
        item.renderQueue.updateAll();
        
        if (item.currentSlot !== undefined) {
            item.currentSlot.renderQueue.updateAll();
        }
        
        this.renderQueue.details = true;
        return true;
    }
    
    // === ARTIFACT PRESTIGE SYSTEM ===
    
    /**
     * Prestige an artifact to the next tier
     * Requires: level 99 mastery + next tier's materials
     * Effect: Resets mastery to level 1, increments tier, updates stats/effects
     */
    prestigeArtifact(item) {
        if(!item.isArtifact) return false;
        if(!item.canPrestige) return false;
        
        const currentTier = this.artifactTiers.get(item) || 0;
        const nextTier = currentTier + 1;
        
        if(nextTier >= item.tiers.length) return false;
        
        // Deduct next tier's materials
        const nextTierData = item.tiers[nextTier];
        if(nextTierData && nextTierData.materials) {
            for(const [material, cost] of nextTierData.materials) {
                this.manager.stash.remove(material, cost);
            }
        }
        
        // Increment tier
        this.artifactTiers.set(item, nextTier);
        
        // Reset mastery XP to level 1
        this.manager.setMasteryXP(item, this.manager.getMasteryXPForLevel(1));
        
        // Apply new tier's stats/effects
        item.applyArtifactTier(nextTier);
        
        // Update render
        item.renderQueue.updateAll();
        if(item.currentSlot !== undefined) {
            item.currentSlot.renderQueue.updateAll();
            // Recalculate character stats
            if(item.currentSlot.equipment.character) {
                item.currentSlot.equipment.character.invalidateStats();
                item.currentSlot.equipment.character.calculateStats();
            }
        }
        
        this.renderQueue.details = true;
        
        // Log the prestige
        this.manager.log.add(`${item.name} has been unlocked!`, 'legendary', item.media);
        
        return true;
    }
    
    /**
     * Get the artifact tier for an item
     */
    getArtifactTier(item) {
        if(!item.isArtifact) return 0;
        return this.artifactTiers.get(item) || 0;
    }

    updateSelectHighlight() {
        this.manager.baseItems.forEach(item => {
            item.setSelected(item === this.selectedItem);
            item.setHighlight(false);
        });

        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(slot.item === this.selectedItem);
                slot.setHighlight(slot.canEquip(this.selectedItem, slot));
            });
        });
        this.renderQueue.details = true;
    }

    selectItem(selectedItem) {
        if(this.selectedItem === selectedItem)
            return this.clearSelected();

        this.selectedItem = selectedItem;
        this.updateSelectHighlight();
    }

    clearSelected() {
        this.selectedItem = undefined;

        this.updateSelectHighlight();
    }

    render() {
        this.upgradeLevels.forEach((level, baseItem) => baseItem.render());
        this.renderDetails();
        this.base.render();
        this.scaling.render();
    }

    renderDetails() {
        if(!this.renderQueue.details)
            return;

        this.component.details.classList.toggle('invisible', this.selectedItem === undefined);

        if(this.selectedItem !== undefined) {
            this.component.icon.src = this.selectedItem.media;
            this.component.nameText.textContent = this.selectedItem.name;

            this.base.reset();
            this.selectedItem.base.forEach((value, stat) => {
                this.base.set(stat, value);
            });
            this.base.renderQueue.stats = true;

            this.scaling.reset();
            this.selectedItem.scaling.forEach((value, stat) => {
                this.scaling.set(stat, value);
            });
            this.scaling.renderQueue.stats = true;

            this.materialComponents.forEach(component => {
                component.remove();
            });

            let componentCount = 0;
            const materials = this.selectedItem.materials || new Map();
            for(let material of materials.keys()) {
                let component = this.materialComponents[componentCount];
                if(component === undefined) {
                    component = createElement('adventuring-material');
                    this.materialComponents[componentCount] = component;
                }

                component.mount(this.component.materials);
                const cost = this.selectedItem.getCost(material);
                const owned = material.count;
                
                component.setTooltipContent(TooltipBuilder.forMaterial(material, this.manager).build());
        
                component.icon.src = material.media;
                component.count.textContent = cost;
        
                // Border based on affordability
                if(owned >= cost) {
                    component.border.classList.remove('border-danger');
                    component.border.classList.add('border-success');
                } else {
                    component.border.classList.remove('border-success');
                    component.border.classList.add('border-danger');
                }
                componentCount++;
            }
        }

        this.renderQueue.details = false;
    }

    encode(writer) {
        writer.writeComplexMap(this.upgradeLevels, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint8(value);
        });
        writer.writeComplexMap(this.unlocked, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        writer.writeComplexMap(this.viewed, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        writer.writeComplexMap(this.masterfulItems, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        writer.writeComplexMap(this.droppedItems, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        // Artifact prestige tiers
        writer.writeComplexMap(this.artifactTiers, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint8(value);
        });

        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getUint8();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.upgradeLevels.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.unlocked.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.viewed.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.masterfulItems.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.droppedItems.set(key, value);
        });
        // Artifact prestige tiers (added in save version with artifacts)
        // Try-catch for backwards compatibility with saves before this feature
        try {
            reader.getComplexMap((reader) => {
                let key = reader.getNamespacedObject(this.manager.baseItems);
                let value = reader.getUint8();
                if(typeof key !== "string" && key.id !== "adventuring:none" && key.isArtifact) {
                    this.artifactTiers.set(key, value);
                    // Apply the loaded tier
                    key.applyArtifactTier(value);
                }
            });
        } catch(e) {
            // Old save without artifact tiers - initialize to 0
            console.log('[Adventuring] No artifact tier data in save, using defaults');
        }
    }
}