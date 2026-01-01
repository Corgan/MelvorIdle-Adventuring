const { loadModule } = mod.getContext(import.meta);

const { RequirementsChecker } = await loadModule('src/core/adventuring-utils.mjs');

export class AdventuringProduct extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.outputType = data.outputType || 'item';
        this._output = data.item || data.material || data.consumable;
        this.count = data.count || 1;
        
        // Store tier data for consumable products
        // New format: tiers array with per-tier requirements/materials
        // Old format: single tier/requirements/materials (backwards compat)
        if (data.tiers && Array.isArray(data.tiers)) {
            this.tiers = data.tiers;
            this.hasTiers = true;
        } else {
            // Legacy single-tier format - wrap in tiers array
            this.tiers = [{
                tier: data.tier || 1,
                requirements: data.requirements || [],
                materials: data.materials || []
            }];
            this.hasTiers = false;
        }
    }

    /**
     * Get tier-specific data
     */
    getTierData(tier) {
        return this.tiers.find(t => t.tier === tier) || this.tiers[0];
    }

    /**
     * Get materials for a specific tier
     */
    getMaterials(tier) {
        const tierData = this.getTierData(tier);
        return tierData?.materials || [];
    }

    /**
     * Get requirements for a specific tier
     */
    getRequirements(tier) {
        const tierData = this.getTierData(tier);
        return tierData?.requirements || [];
    }

    /**
     * Get name for display - tier-specific for consumables and conversions
     */
    getName(tier = 1) {
        if (this.outputType === 'consumable' && this.output?.getTierName) {
            return this.output.getTierName(tier);
        }
        if (this.outputType === 'conversion') {
            const tierData = this.getTierData(tier);
            return tierData?.outputMaterial?.name ?? 'Unknown';
        }
        return this.output?.name ?? 'Unknown';
    }

    /**
     * Get media for display - tier-specific for consumables and conversions
     */
    getMedia(tier = 1) {
        if (this.outputType === 'consumable' && this.output?.getTierMedia) {
            return this.output.getTierMedia(tier);
        }
        if (this.outputType === 'conversion') {
            const tierData = this.getTierData(tier);
            return tierData?.outputMaterial?.media ?? 'assets/media/main/question.png';
        }
        return this.output?.media ?? 'assets/media/main/question.png';
    }

    // Legacy getters for backwards compatibility (use tier 1)
    get name() {
        return this.getName(1);
    }

    get media() {
        return this.getMedia(1);
    }

    get requirements() {
        return this.getRequirements(1);
    }

    get materials() {
        return this.getMaterials(1);
    }

    // Alias for backwards compatibility
    get item() {
        return this.output;
    }

    onLoad() {

    }

    postDataRegistration() {
        if (this.output) return;
        
        // Create requirements checkers for each tier
        this._reqCheckers = new Map();
        for (const tierData of this.tiers) {
            if (tierData.requirements && tierData.requirements.length > 0) {
                this._reqCheckers.set(tierData.tier, new RequirementsChecker(this.manager, tierData.requirements));
            }
        }
        
        switch(this.outputType) {
            case 'conversion':
                // Conversion products output materials - resolve each tier's material
                for (const tierData of this.tiers) {
                    if (tierData.material) {
                        tierData.outputMaterial = this.manager.materials.getObjectByID(tierData.material);
                        if (!tierData.outputMaterial) {
                            console.warn(`[Adventuring] Conversion product "${this.id}" tier ${tierData.tier} could not resolve material: ${tierData.material}`);
                        }
                    }
                }
                // Use first tier's material as default output for display
                this.output = this.tiers[0]?.outputMaterial;
                break;
            case 'material':
                this.output = this.manager.materials.getObjectByID(this._output);
                break;
            case 'consumable':
                this.output = this.manager.consumableTypes.getObjectByID(this._output);
                break;
            case 'item':
            default:
                this.output = this.game.items.getObjectByID(this._output);
                break;
        }
        if(!this.output && this.outputType !== 'conversion') {
            console.warn(`[Adventuring] Product "${this.id}" could not resolve output: ${this._output} (type: ${this.outputType})`);
        }
        delete this._output;
    }

    /**
     * Create the product at the specified tier
     */
    create(tier = 1) {
        const materials = this.getMaterials(tier);
        const tierData = this.getTierData(tier);
        const count = tierData.count || this.count;
        
        for(let mat of materials) {
            let material = this.manager.materials.getObjectByID(mat.id);
            this.manager.stash.remove(material, mat.count);
        }
        
        // For consumable outputs, add charges to the specific tier
        if (this.outputType === 'consumable' && this.output) {
            this.manager.consumables.addCharges(this.output, tier, count);
        }
        
        // For conversion outputs, add the tier's material to stash
        if (this.outputType === 'conversion' && tierData.outputMaterial) {
            this.manager.stash.add(tierData.outputMaterial, count);
        }
        
        // For material outputs, add directly to stash
        if (this.outputType === 'material' && this.output) {
            this.manager.stash.add(this.output, count);
        }
        
        // For item outputs, return data for workshop to handle (ship to bank)
        return { 
            output: this.outputType === 'conversion' ? tierData.outputMaterial : this.output,
            outputType: this.outputType,
            count: count,
            tier: tier
        }
    }

    /**
     * Check if the product can be made at the specified tier
     */
    canMake(character, tier = 1) {
        const materials = this.getMaterials(tier);
        
        // Check materials first
        if(materials.length > 0) {
            for(let material of materials) {
                let mat = this.manager.materials.getObjectByID(material.id);
                if(this.manager.stash.materialCounts.get(mat) < material.count)
                    return false;
            }
        }
        
        // Check requirements
        const checker = this._reqCheckers?.get(tier);
        return checker?.check({ character }) ?? true;
    }

    /**
     * Check if this product has the specified tier
     */
    hasTier(tier) {
        return this.tiers.some(t => t.tier === tier);
    }

    /**
     * Get all available tiers for this product
     */
    getAvailableTiers() {
        return this.tiers.map(t => t.tier).sort((a, b) => a - b);
    }
}