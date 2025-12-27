const { loadModule } = mod.getContext(import.meta);

const { RequirementsChecker } = await loadModule('src/core/adventuring-utils.mjs');

export class AdventuringProduct extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.outputType = data.outputType || 'item';
        this._output = data.item || data.material || data.consumable || data.baseItem;
        this.count = data.count;

        this.requirements = data.requirements;
        this.materials = data.materials;
    }

    get name() {
        return this.output?.name ?? 'Unknown';
    }

    get media() {
        return this.output?.media ?? 'assets/media/main/question.png';
    }

    // Alias for backwards compatibility
    get item() {
        return this.output;
    }

    onLoad() {

    }

    postDataRegistration() {
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
        
        switch(this.outputType) {
            case 'material':
                this.output = this.manager.materials.getObjectByID(this._output);
                break;
            case 'consumable':
                this.output = this.manager.consumableTypes.getObjectByID(this._output);
                break;
            case 'baseItem':
                this.output = this.manager.baseItems.getObjectByID(this._output);
                break;
            case 'item':
            default:
                this.output = this.game.items.getObjectByID(this._output);
                break;
        }
        if(!this.output) {
            console.warn(`[Adventuring] Product "${this.id}" could not resolve output: ${this._output} (type: ${this.outputType})`);
        }
        delete this._output;
    }

    create() {
        for(let mat of this.materials) {
            let material = this.manager.materials.getObjectByID(mat.id);
            this.manager.stash.remove(material, mat.count);
        }
        return { 
            output: this.output,
            outputType: this.outputType,
            count: this.count
        }
    }

    canMake(character) {
        // Check materials first
        if(this.materials.length > 0) {
            for(let material of this.materials) {
                let mat = this.manager.materials.getObjectByID(material.id);
                if(this.manager.stash.materialCounts.get(mat) < material.count)
                    return false;
            }
        }
        // Check requirements
        return this._reqChecker?.check({ character }) ?? true;
    }
}