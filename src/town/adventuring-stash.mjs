const { loadModule } = mod.getContext(import.meta);


const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringEquipment } = await loadModule('src/items/adventuring-equipment.mjs');
const { AdventuringStashElement } = await loadModule('src/town/components/adventuring-stash.mjs');

export class AdventuringStash extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.materialCounts = new Map();
        this.unlocked = new Map();
        this.seenMaterials = new Set();  // Track which materials have been seen (for NEW badge)

        this.component = createElement('adventuring-stash');
    }

    // ========== Multi-Currency Support ==========

    /**
     * Get a currency material by its local ID
     * @param {string} currencyId - e.g., 'currency' or 'slayer_coins'
     */
    getCurrencyMaterial(currencyId = 'currency') {
        return this.manager.materials.getObjectByID(`adventuring:${currencyId}`);
    }

    /**
     * Get all currency materials
     */
    get allCurrencies() {
        return this.manager.materials.allObjects.filter(m => m.isCurrency);
    }

    /**
     * Get the amount of a specific currency
     * @param {string} currencyId - e.g., 'currency' or 'slayer_coins'
     */
    getCurrency(currencyId = 'currency') {
        const curr = this.getCurrencyMaterial(currencyId);
        return curr ? (this.materialCounts.get(curr) || 0) : 0;
    }

    /**
     * Get the icon URL for a specific currency
     * @param {string} currencyId - e.g., 'currency' or 'slayer_coins'
     */
    getCurrencyMedia(currencyId = 'currency') {
        const curr = this.getCurrencyMaterial(currencyId);
        return curr ? curr.media : '';
    }

    /**
     * Add a specific currency
     * @param {string} currencyId - e.g., 'currency' or 'slayer_coins'
     * @param {number} qty - Amount to add
     */
    addCurrencyById(currencyId, qty) {
        const curr = this.getCurrencyMaterial(currencyId);
        if(curr) this.add(curr, qty);
    }

    /**
     * Remove a specific currency
     * @param {string} currencyId - e.g., 'currency' or 'slayer_coins'
     * @param {number} qty - Amount to remove
     */
    removeCurrencyById(currencyId, qty) {
        const curr = this.getCurrencyMaterial(currencyId);
        if(curr) this.remove(curr, qty);
    }

    // ========== Legacy Currency Shortcuts (for adventuring coins) ==========

    /**
     * Get the default currency material (adventuring coins)
     */
    get currencyMaterial() {
        return this.getCurrencyMaterial('currency');
    }

    /**
     * Get the current adventuring coins count
     */
    get currency() {
        return this.getCurrency('currency');
    }

    /**
     * Get the adventuring coins icon URL
     */
    get currencyMedia() {
        return this.getCurrencyMedia('currency');
    }

    /**
     * Add adventuring coins
     */
    addCurrency(qty) {
        this.addCurrencyById('currency', qty);
    }

    /**
     * Remove adventuring coins
     */
    removeCurrency(qty) {
        this.removeCurrencyById('currency', qty);
    }

    // ========== Slayer Coins Shortcuts ==========

    /**
     * Get the slayer coins material
     */
    get slayerCoinsMaterial() {
        return this.getCurrencyMaterial('slayer_coins');
    }

    /**
     * Get the current slayer coins count
     */
    get slayerCoins() {
        return this.getCurrency('slayer_coins');
    }

    /**
     * Get the slayer coins icon URL
     */
    get slayerCoinsMedia() {
        return this.getCurrencyMedia('slayer_coins');
    }

    /**
     * Add slayer coins
     */
    addSlayerCoins(qty) {
        this.addCurrencyById('slayer_coins', qty);
    }

    /**
     * Remove slayer coins
     */
    removeSlayerCoins(qty) {
        this.removeCurrencyById('slayer_coins', qty);
    }

    // ========== General Material Methods ==========

    /**
     * Get count of a material
     */
    getCount(material) {
        return this.materialCounts.get(material) || 0;
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.setAllLocked(this.manager.isActive);
        
        // Mark all unlocked materials as seen when viewing stash
        this.markAllSeen();
    }

    onHide() {
        this.manager.party.setAllLocked(this.manager.isActive);
    }
    
    /**
     * Mark all unlocked materials as seen (removes NEW badge)
     */
    markAllSeen() {
        this.unlocked.forEach((unlocked, material) => {
            if(unlocked && !this.seenMaterials.has(material.id)) {
                this.seenMaterials.add(material.id);
                material.renderQueue.newBadge = true;
            }
        });
    }

    postDataRegistration() {
        // Materials register themselves via registerMaterial() in their postDataRegistration
    }

    registerMaterial(material) {
        this.materialCounts.set(material, 0);
        
        const category = material.category;
        if (!category) {
            console.warn(`Material ${material.id} has no category defined`);
            return;
        }
        
        const container = this.component.getCategoryContainer(category.id, category.name);
        material.component.mount(container);
    }

    unlock(item) {
        this.unlocked.set(item, true);
        item.renderQueue.updateAll();
        this.manager.armory.checkUnlocked();
    }

    add(material, qty) {
        if(typeof material === "string")
            material = this.manager.materials.getObjectByID(material);
        let count = this.materialCounts.get(material);
        if(count !== undefined) {
            if(!material.unlocked)
                this.unlock(material);
            this.materialCounts.set(material, count + qty);
            material.renderQueue.name = true;
            material.renderQueue.icon = true;
            material.renderQueue.count = true;
            this.manager.log.add(`Found ${qty} ${material.name}`);
            
            // Track material collection for Slayer tasks
            this.manager.slayers.onMaterialCollected(material, qty);

            // Track for achievements
            if(this.manager.achievementManager) {
                if(material.isCurrency) {
                    this.manager.achievementManager.recordCurrency(qty);
                } else {
                    this.manager.achievementManager.recordMaterials(qty);
                }
            }

            // Check tutorial triggers
            if(material.isCurrency) {
                this.manager.tutorialManager.checkTriggers('currency');
            } else {
                this.manager.tutorialManager.checkTriggers('material');
            }
        }
    }

    remove(material, qty) {
        if(typeof material === "string")
            material = this.manager.materials.getObjectByID(material);
        let count = this.materialCounts.get(material);
        if(count !== undefined) {
            let amount = Math.max(0, count - qty);
            this.materialCounts.set(material, amount);
            material.renderQueue.count = true;
        }
    }

    reset() {
        this.materialCounts.forEach((count, material) => {
            this.materialCounts.set(material, 0);
            material.renderQueue.count = true;
        });
        this.unlocked.clear();
        this.seenMaterials.clear();
    }

    render() {
        this.materialCounts.forEach((count, material) => material.render());
    }

    encode(writer) {
        writer.writeComplexMap(this.materialCounts, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint32(value);
        });
        writer.writeComplexMap(this.unlocked, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });
        
        // Encode seen materials (version 11+)
        writer.writeUint32(this.seenMaterials.size);
        this.seenMaterials.forEach(materialId => {
            writer.writeString(materialId);
        });

        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.materials);
            let value = reader.getUint32();
            if(typeof key !== "string") {
                this.materialCounts.set(key, value);
            }
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.materials);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.unlocked.set(key, value);
        });
        
        const numSeen = reader.getUint32();
        for(let i = 0; i < numSeen; i++) {
            const materialId = reader.getString();
            this.seenMaterials.add(materialId);
        }
    }
}