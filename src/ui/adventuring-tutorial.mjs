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

    /**
     * Check if this tutorial should trigger for a conductor event
     * @param {string} eventType - The conductor event type
     * @param {Object} context - Event context from conductor
     * @returns {boolean}
     */
    checkTrigger(eventType, context = {}) {
        if(!this.trigger) return false;
        
        const triggerType = this.trigger.type;
        
        // Handle lifecycle triggers (not from conductor)
        if(triggerType === 'immediate' || triggerType === 'chained') {
            return triggerType === eventType;
        }
        
        // Handle threshold-based triggers (checked when relevant events fire)
        if(triggerType === 'currency_threshold') {
            // Only check on currency_collected events
            if(eventType !== 'currency_collected') return false;
            const currency = this.manager.stash.getCurrency(this.trigger.currencyId || 'currency');
            return currency >= this.trigger.amount;
        }
        
        if(triggerType === 'material_threshold') {
            // Only check on material_collected events
            if(eventType !== 'material_collected') return false;
            return this.checkMaterialTrigger();
        }
        
        // Handle direct conductor event triggers
        if(triggerType !== eventType) return false;
        
        // Check conditions if present
        if(this.trigger.conditions) {
            for(const [key, expected] of Object.entries(this.trigger.conditions)) {
                if(context[key] !== expected) return false;
            }
        }
        
        // Check level thresholds for level-up events
        if(triggerType === 'mastery_level_up' || triggerType === 'skill_level_up') {
            if(this.trigger.category && context.category !== this.trigger.category) return false;
            if(this.trigger.level && context.level < this.trigger.level) return false;
        }
        
        return true;
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
