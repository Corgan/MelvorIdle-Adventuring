export class AdventuringTutorialStep {
    constructor(data, tutorial) {
        this.tutorial = tutorial;
        this.target = data.target;
        this.message = data.message;
        this.position = data.position || 'bottom';
    }
}

export class AdventuringTutorial extends NamespacedObject {
    constructor(namespace, data, manager) {
        super(namespace, data.id);
        this.manager = manager;
        this._name = data.name;
        this.priority = (data.priority !== undefined) ? data.priority : 10;
        this.trigger = data.trigger;
        this.chainTo = data.chainTo || null;
        this.requiresState = data.requiresState || null; // 'town' or 'dungeon'
        this.steps = [];
        if(data.steps) {
            data.steps.forEach(stepData => {
                this.steps.push(new AdventuringTutorialStep(stepData, this));
            });
        }
    }

    get name() {
        return this._name;
    }

    checkTrigger(triggerType, context = {}) {
        if(!this.trigger) return false;
        if(this.trigger.type !== triggerType) return false;

        switch(this.trigger.type) {
            case 'immediate':
                return true;

            case 'chained':
                return false;

            case 'currency':
                const currency = this.manager.stash.getCurrency(this.trigger.currencyId || 'currency');
                return currency >= this.trigger.amount;

            case 'material':
                return this.checkMaterialTrigger();

            case 'mastery':
                if(context.category !== this.trigger.category) return false;
                return context.level >= this.trigger.level;

            case 'skillLevel':
                return context.level >= this.trigger.level;

            case 'event':
                return context.event === this.trigger.event;

            default:
                return false;
        }
    }

    checkMaterialTrigger() {
        var manager = this.manager;

        if(this.trigger.check === 'anyUpgrade') {
            return manager.baseItems.allObjects.some(function(item) {
                if(!item.unlocked) return false;
                return item.upgradeable;
            });
        }

        if(this.trigger.check === 'anyCraft') {
            return manager.consumableTypes.allObjects.some(function(consumable) {
                if(typeof consumable.canAfford !== 'function') return false;
                return consumable.canAfford();
            });
        }
        if(this.trigger.materials) {
            return this.trigger.materials.every(function(req) {
                var material = manager.materials.getObjectByID(req.id);
                if(!material) return false;
                var count = manager.stash.getCount(material);
                return count >= req.amount;
            });
        }

        return false;
    }
}
