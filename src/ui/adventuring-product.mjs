const { loadModule } = mod.getContext(import.meta);

const { RequirementsChecker } = await loadModule('src/core/utils/requirements-checker.mjs');

export class AdventuringProduct extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.outputType = data.outputType || 'item';
        this._output = data.item || data.material || data.consumable;
        this.count = data.count || 1;



        if (data.tiers && Array.isArray(data.tiers)) {
            this.tiers = data.tiers;
            this.hasTiers = true;
        } else {

            this.tiers = [{
                tier: data.tier || 1,
                requirements: data.requirements || [],
                materials: data.materials || []
            }];
            this.hasTiers = false;
        }
    }

    getTierData(tier) {
        return this.tiers.find(t => t.tier === tier) || this.tiers[0];
    }

    getMaterials(tier) {
        const tierData = this.getTierData(tier);
        return tierData !== undefined && tierData.materials !== undefined ? tierData.materials : [];
    }

    getRequirements(tier) {
        const tierData = this.getTierData(tier);
        return tierData !== undefined && tierData.requirements !== undefined ? tierData.requirements : [];
    }

    getName(tier = 1) {
        if (this.outputType === 'consumable' && this.output !== undefined && this.output.getTierName !== undefined) {
            return this.output.getTierName(tier);
        }
        if (this.outputType === 'conversion') {
            const tierData = this.getTierData(tier);
            if (tierData !== undefined && tierData.outputMaterial !== undefined && tierData.outputMaterial.name !== undefined) {
                return tierData.outputMaterial.name;
            }
            return 'Unknown';
        }
        return this.output !== undefined && this.output.name !== undefined ? this.output.name : 'Unknown';
    }

    getMedia(tier = 1) {
        if (this.outputType === 'consumable' && this.output !== undefined && this.output.getTierMedia !== undefined) {
            return this.output.getTierMedia(tier);
        }
        if (this.outputType === 'conversion') {
            const tierData = this.getTierData(tier);
            if (tierData !== undefined && tierData.outputMaterial !== undefined && tierData.outputMaterial.media !== undefined) {
                return tierData.outputMaterial.media;
            }
            return 'assets/media/main/question.png';
        }
        return this.output !== undefined && this.output.media !== undefined ? this.output.media : 'assets/media/main/question.png';
    }

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

    get item() {
        return this.output;
    }

    onLoad() {

    }

    postDataRegistration() {
        if (this.output) return;

        this._reqCheckers = new Map();
        for (const tierData of this.tiers) {
            if (tierData.requirements && tierData.requirements.length > 0) {
                this._reqCheckers.set(tierData.tier, new RequirementsChecker(this.manager, tierData.requirements));
            }
        }

        switch(this.outputType) {
            case 'conversion':

                for (const tierData of this.tiers) {
                    if (tierData.material) {
                        tierData.outputMaterial = this.manager.materials.getObjectByID(tierData.material);
                        if (!tierData.outputMaterial) {
                            console.warn(`[Adventuring] Conversion product "${this.id}" tier ${tierData.tier} could not resolve material: ${tierData.material}`);
                        }
                    }
                }

                this.output = this.tiers[0] !== undefined ? this.tiers[0].outputMaterial : undefined;
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

    create(tier = 1) {
        const materials = this.getMaterials(tier);
        const tierData = this.getTierData(tier);
        const count = tierData.count || this.count;

        for(let mat of materials) {
            let material = this.manager.materials.getObjectByID(mat.id);
            this.manager.stash.remove(material, mat.count);
        }

        if (this.outputType === 'consumable' && this.output) {
            this.manager.consumables.addCharges(this.output, tier, count);
        }

        if (this.outputType === 'conversion' && tierData.outputMaterial) {
            this.manager.stash.add(tierData.outputMaterial, count);
        }

        if (this.outputType === 'material' && this.output) {
            this.manager.stash.add(this.output, count);
        }

        return {
            output: this.outputType === 'conversion' ? tierData.outputMaterial : this.output,
            outputType: this.outputType,
            count: count,
            tier: tier
        }
    }

    canMake(character, tier = 1) {
        const materials = this.getMaterials(tier);

        if(materials.length > 0) {
            for(let material of materials) {
                let mat = this.manager.materials.getObjectByID(material.id);
                if(this.manager.stash.materialCounts.get(mat) < material.count)
                    return false;
            }
        }

        if (this._reqCheckers === undefined) return true;
        const checker = this._reqCheckers.get(tier);
        if (checker === undefined) return true;
        return checker.check({ character });
    }

    hasTier(tier) {
        return this.tiers.some(t => t.tier === tier);
    }

    getAvailableTiers() {
        return this.tiers.map(t => t.tier).sort((a, b) => a - b);
    }
}