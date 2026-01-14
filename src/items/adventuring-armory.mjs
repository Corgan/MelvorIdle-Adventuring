const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

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

        this.categoryNames = {
            recent: '★ Recently Unlocked',
            melee: 'Melee',
            ranged: 'Ranged',
            magic: 'Magic',
            heavy: 'Heavy Armor',
            medium: 'Medium Armor',
            light: 'Light Armor',
            accessories: 'Accessories',
            artifacts: 'Artifacts',
            jobweapons: 'Job Weapons'
        };

        this.component.optionRecent.onclick = () => this.setCategory('recent');
        this.component.optionMelee.onclick = () => this.setCategory('melee');
        this.component.optionRanged.onclick = () => this.setCategory('ranged');
        this.component.optionMagic.onclick = () => this.setCategory('magic');
        this.component.optionHeavy.onclick = () => this.setCategory('heavy');
        this.component.optionMedium.onclick = () => this.setCategory('medium');
        this.component.optionLight.onclick = () => this.setCategory('light');
        this.component.optionAccessories.onclick = () => this.setCategory('accessories');
        this.component.optionArtifacts.onclick = () => this.setCategory('artifacts');
        this.component.optionJobWeapons.onclick = () => this.setCategory('jobweapons');
    }

    getItemCategory(baseItem) {

        if(baseItem.isJobWeapon) return 'jobweapons';
        if(baseItem.isArtifact) return 'artifacts';

        if(!baseItem.type) return 'melee';
        const typeId = baseItem.type.id;

        const meleeTypes = ['adventuring:dagger', 'adventuring:sword1h', 'adventuring:sword2h', 'adventuring:axe', 'adventuring:scimitar', 'adventuring:fists', 'adventuring:polearm', 'adventuring:hammer2h', 'adventuring:mace', 'adventuring:shield'];
        if(meleeTypes.includes(typeId)) return 'melee';

        const rangedTypes = ['adventuring:knives', 'adventuring:javelin', 'adventuring:crossbow', 'adventuring:shortbow', 'adventuring:longbow', 'adventuring:buckler', 'adventuring:quiver'];
        if(rangedTypes.includes(typeId)) return 'ranged';

        const magicTypes = ['adventuring:wand', 'adventuring:staff', 'adventuring:orb', 'adventuring:spellbook'];
        if(magicTypes.includes(typeId)) return 'magic';

        const heavyTypes = ['adventuring:helm', 'adventuring:platebody', 'adventuring:platelegs', 'adventuring:gauntlets', 'adventuring:sabatons'];
        if(heavyTypes.includes(typeId)) return 'heavy';

        const mediumTypes = ['adventuring:cowl', 'adventuring:vest', 'adventuring:chaps', 'adventuring:vambraces', 'adventuring:boots'];
        if(mediumTypes.includes(typeId)) return 'medium';

        const lightTypes = ['adventuring:hat', 'adventuring:robes', 'adventuring:bottoms', 'adventuring:mitts', 'adventuring:slippers'];
        if(lightTypes.includes(typeId)) return 'light';

        const accessoryTypes = ['adventuring:amulet', 'adventuring:ring', 'adventuring:cape'];
        if(accessoryTypes.includes(typeId)) return 'accessories';

        return 'melee'; // Default
    }

    setCategory(category) {
        this.activeCategory = category;

        this.component.categoryDropdownButton.textContent = this.categoryNames[category] || category;

        this.renderCategoryItems();
    }

    renderCategoryItems() {
        this.component.items.replaceChildren();

        let categoryItems;
        if(this.activeCategory === 'recent') {
            categoryItems = this.manager.baseItems.filter(item =>
                item.id !== 'adventuring:none' && this.isNew(item)
            );

            categoryItems.forEach(baseItem => {
                baseItem.component.mount(this.component.items);
                baseItem.renderQueue.tooltip = true;
            });
            return;
        } else {
            categoryItems = this.manager.baseItems.filter(item =>
                item.id !== 'adventuring:none' && this.getItemCategory(item) === this.activeCategory
            );
        }

        // For armor categories (heavy, medium, light), group by equipment set
        const armorCategories = ['heavy', 'medium', 'light'];
        if(armorCategories.includes(this.activeCategory)) {
            const setGroups = new Map();
            categoryItems.forEach(item => {
                const setName = item.set ? item.set.name : 'Uniques';
                if(!setGroups.has(setName)) {
                    setGroups.set(setName, []);
                }
                setGroups.get(setName).push(item);
            });

            // Sort sets by first item's tier/order, then render
            const sortedSets = [...setGroups.entries()].sort((a, b) => {
                // "Uniques" always last
                if(a[0] === 'Uniques') return 1;
                if(b[0] === 'Uniques') return -1;
                // Sort by first item's id (which includes tier info)
                const aFirst = a[1][0];
                const bFirst = b[1][0];
                return (aFirst?.id || '').localeCompare(bFirst?.id || '');
            });

            sortedSets.forEach(([setName, items]) => {
                if(items.length > 0) {
                    this.component.items.appendChild(createElement('div', { className: 'p-1 w-100 font-w600 text-warning', text: setName }));
                    items.forEach(baseItem => {
                        baseItem.component.mount(this.component.items);
                        baseItem.renderQueue.tooltip = true;
                    });
                }
            });
        } else {
            // For other categories, group by type
            const typeGroups = new Map();
            categoryItems.forEach(item => {
                const typeName = item.type ? item.type.name : 'Other';
                if(!typeGroups.has(typeName)) {
                    typeGroups.set(typeName, []);
                }
                typeGroups.get(typeName).push(item);
            });

            typeGroups.forEach((items, typeName) => {
                if(items.length > 0) {
                    this.component.items.appendChild(createElement('div', { className: 'p-1 w-100 font-w600 text-warning', text: typeName }));
                    items.forEach(baseItem => {
                        baseItem.component.mount(this.component.items);

                        baseItem.renderQueue.tooltip = true;
                    });
                }
            });
        }
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

        const newCount = this.getNewCount();
        this.component.optionRecent.classList.toggle('d-none', newCount === 0);

        if(newCount > 0) {
            this.setCategory('recent');
        } else {
            this.renderCategoryItems();
        }

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

        this.renderCategoryItems();
    }

    checkUnlocked() {
        this.upgradeLevels.forEach((level, baseItem) => {

            if(this.unlocked.get(baseItem) === true) return;

            if(baseItem.requirementsMet) {
                this.unlock(baseItem);
                baseItem.renderQueue.updateAll();
            }
        });
    }

    unlock(item) {
        this.unlocked.set(item, true);
        this.droppedItems.set(item, true); // Also mark as discovered

        if (this.upgradeLevels.get(item) < 1) {
            this.upgradeLevels.set(item, 1);
        }
        item.renderQueue.updateAll();
        this.renderQueue.details = true;
    }

    markDropped(item, notify = true, rarity = null) {
        if (this.droppedItems.get(item) === true) return; // Already dropped

        this.droppedItems.set(item, true);
        item.renderQueue.updateAll();

        if (notify) {

            const itemRarity = rarity || item.rarity || 'common';
            const message = this.getDropMessage(item.name, itemRarity);
            const logType = this.getLogTypeForRarity(itemRarity);
            this.manager.log.add(message, logType);
        }

        this.checkUnlocked();
    }

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

    preCraftItem(itemId) {
        const item = this.manager.baseItems.getObjectByID(itemId);
        if(!item) {
            console.warn(`[Adventuring] Could not pre-craft item: ${itemId}`);
            return null;
        }

        this.unlocked.set(item, true);
        this.upgradeLevels.set(item, 1);
        this.viewed.set(item, true); // Don't show as NEW
        item.renderQueue.updateAll();

        return item;
    }

    markViewed(item) {
        if(this.unlocked.get(item) && !this.viewed.get(item)) {
            this.viewed.set(item, true);
            item.renderQueue.updateAll();
        }
    }

    markAllViewed() {
        this.unlocked.forEach((unlocked, item) => {
            if(unlocked && !this.viewed.get(item)) {
                this.viewed.set(item, true);
                item.renderQueue.updateAll();
            }
        });
    }

    isNew(item) {
        return this.unlocked.get(item) === true && this.viewed.get(item) !== true;
    }

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
            // Double-check we're not exceeding max upgrades
            if (this.upgradeLevels.get(item) >= item.maxUpgrades) {
                console.warn(`[Adventuring] Attempted to upgrade ${item.name} beyond max level`);
                return;
            }

            for(let material of item.materials.keys()) {
                this.manager.stash.remove(material, item.getCost(material));
            }

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

    canUpgradeToMasterful(item) {
        if (this.masterfulItems.get(item)) return false; // Already masterful
        if (this.upgradeLevels.get(item) < item.maxUpgrades) return false; // Not max upgrade
        if (item.level < 99) return false; // Not max mastery level

        const tokenCosts = this.getMasterfulTokenCost(item);
        for (const [tokenId, cost] of Object.entries(tokenCosts)) {
            const token = this.manager.materials.getObjectByID(tokenId);
            if (!token) return false;
            const available = this.manager.stash.materialCounts.get(token) || 0;
            if (available < cost) return false;
        }

        return true;
    }

    getMasterfulTokenCost(item) {

        const tier = item.tier || 1;
        const baseCost = Math.max(1, Math.floor(tier / 3));

        return {
            'adventuring:gauntlet_token': baseCost,
            'adventuring:gauntlet_token_ii': baseCost,
            'adventuring:gauntlet_token_iii': baseCost
        };
    }

    upgradeToMasterful(item) {
        if (!this.canUpgradeToMasterful(item)) return false;

        const tokenCosts = this.getMasterfulTokenCost(item);
        for (const [tokenId, cost] of Object.entries(tokenCosts)) {
            const token = this.manager.materials.getObjectByID(tokenId);
            if (token) {
                this.manager.stash.remove(token, cost);
            }
        }

        this.masterfulItems.set(item, true);
        item.calculateStats();
        item.renderQueue.updateAll();

        if (item.currentSlot !== undefined) {
            item.currentSlot.renderQueue.updateAll();
        }

        this.renderQueue.details = true;
        return true;
    }

    prestigeArtifact(item) {
        if(!item.isArtifact) return false;
        if(!item.canPrestige) return false;

        const currentTier = this.artifactTiers.get(item) || 0;
        const nextTier = currentTier + 1;

        if(nextTier >= item.tiers.length) return false;

        const nextTierData = item.tiers[nextTier];
        if(nextTierData && nextTierData.materials) {
            for(const [material, cost] of nextTierData.materials) {
                this.manager.stash.remove(material, cost);
            }
        }

        this.artifactTiers.set(item, nextTier);

        this.manager.setMasteryXP(item, this.manager.getMasteryXPForLevel(1));

        item.applyArtifactTier(nextTier);

        item.renderQueue.updateAll();
        if(item.currentSlot !== undefined) {
            item.currentSlot.renderQueue.updateAll();

            if(item.currentSlot.equipment.character) {
                item.currentSlot.equipment.character.invalidateStats();
                item.currentSlot.equipment.character.calculateStats();
            }
        }

        this.renderQueue.details = true;

        this.manager.log.add(`${item.name} has been unlocked!`, 'legendary');

        return true;
    }

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

                if(owned >= cost) {
                    component.border.classList.remove('border-danger');
                    component.border.classList.add('border-success');
                } else {
                    component.border.classList.remove('border-success');
                    component.border.classList.add('border-danger');
                }
                componentCount++;
            }

            // Show upgrade tier materials
            const upgradeMaterials = this.selectedItem.getUpgradeTierMaterials();
            for(let material of upgradeMaterials) {
                let component = this.materialComponents[componentCount];
                if(component === undefined) {
                    component = createElement('adventuring-material');
                    this.materialComponents[componentCount] = component;
                }

                component.mount(this.component.materials);
                const cost = this.selectedItem.getUpgradeTierCost(material);
                const owned = material.count;

                component.setTooltipContent(TooltipBuilder.forMaterial(material, this.manager).build());

                component.icon.src = material.media;
                component.count.textContent = cost;

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
        const nonZeroUpgrades = [...this.upgradeLevels.entries()].filter(([_, level]) => level > 0);
        writer.writeUint32(nonZeroUpgrades.length);
        for (const [item, level] of nonZeroUpgrades) {
            writer.writeNamespacedObject(item);
            writer.writeUint8(level);
        }

        const unlockedItems = [...this.unlocked.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(unlockedItems.length);
        for (const item of unlockedItems) {
            writer.writeNamespacedObject(item);
        }

        const viewedItems = [...this.viewed.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(viewedItems.length);
        for (const item of viewedItems) {
            writer.writeNamespacedObject(item);
        }

        const masterfulList = [...this.masterfulItems.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(masterfulList.length);
        for (const item of masterfulList) {
            writer.writeNamespacedObject(item);
        }

        const droppedList = [...this.droppedItems.entries()].filter(([_, v]) => v).map(([k]) => k);
        writer.writeUint32(droppedList.length);
        for (const item of droppedList) {
            writer.writeNamespacedObject(item);
        }

        const nonZeroTiers = [...this.artifactTiers.entries()].filter(([_, tier]) => tier > 0);
        writer.writeUint32(nonZeroTiers.length);
        for (const [item, tier] of nonZeroTiers) {
            writer.writeNamespacedObject(item);
            writer.writeUint8(tier);
        }

        return writer;
    }

    decode(reader, version) {
        const numUpgrades = reader.getUint32();
        for (let i = 0; i < numUpgrades; i++) {
            const key = reader.getNamespacedObject(this.manager.baseItems);
            const value = reader.getUint8();
            if (typeof key !== "string" && key.id !== "adventuring:none") {
                this.upgradeLevels.set(key, value);
            }
        }

        const numUnlocked = reader.getUint32();
        for (let i = 0; i < numUnlocked; i++) {
            const key = reader.getNamespacedObject(this.manager.baseItems);
            if (typeof key !== "string" && key.id !== "adventuring:none") {
                this.unlocked.set(key, true);
            }
        }

        const numViewed = reader.getUint32();
        for (let i = 0; i < numViewed; i++) {
            const key = reader.getNamespacedObject(this.manager.baseItems);
            if (typeof key !== "string" && key.id !== "adventuring:none") {
                this.viewed.set(key, true);
            }
        }

        const numMasterful = reader.getUint32();
        for (let i = 0; i < numMasterful; i++) {
            const key = reader.getNamespacedObject(this.manager.baseItems);
            if (typeof key !== "string" && key.id !== "adventuring:none") {
                this.masterfulItems.set(key, true);
            }
        }

        const numDropped = reader.getUint32();
        for (let i = 0; i < numDropped; i++) {
            const key = reader.getNamespacedObject(this.manager.baseItems);
            if (typeof key !== "string" && key.id !== "adventuring:none") {
                this.droppedItems.set(key, true);
            }
        }

        try {
            const numTiers = reader.getUint32();
            for (let i = 0; i < numTiers; i++) {
                const key = reader.getNamespacedObject(this.manager.baseItems);
                const value = reader.getUint8();
                if (typeof key !== "string" && key.id !== "adventuring:none" && key.isArtifact) {
                    this.artifactTiers.set(key, value);
                    key.applyArtifactTier(value);
                }
            }
        } catch(e) {
            console.log('[Adventuring] No artifact tier data in save, using defaults');
        }
    }
}