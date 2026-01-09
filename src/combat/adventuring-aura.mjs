const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { parseDescription, buildEffectReplacements, describeEffectFull } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringAuraElement } = await loadModule('src/combat/components/adventuring-aura.mjs');

class AdventuringAuraRenderQueue {
    constructor() {
        this.name = false;
        this.description = false;
        this.highlight = false;
        this.descriptionCharacter = false;
    }

    queueAll() {
        this.name = true;
        this.description = true;
        this.highlight = true;
    }
}

/**
 * Aura effect that extends ScalableEffect for stat-based scaling.
 * 
 * Supports all ScalableEffect features plus:
 * - consume: remove stacks when triggered
 * - perStack: multiply amount by stack count
 * - scaleFrom: 'source' | 'target' | 'snapshot'
 * - age: for remove effects that trigger after N rounds
 * - modifier: legacy multiplier support
 * - count: stack count multiplier
 */
class AdventuringAuraEffect extends AdventuringScalableEffect {
    constructor(manager, game, aura, data) {
        // Normalize amount to ScalableEffect format if it's a plain number
        const normalizedData = { ...data };
        if (data.amount !== undefined && typeof data.amount === 'number') {
            normalizedData.amount = { base: data.amount };
        }
        if (data.stacks !== undefined && typeof data.stacks === 'number') {
            normalizedData.stacks = { base: data.stacks };
        }
        
        super(manager, game, normalizedData);
        
        this.aura = aura;
        this.consume = data.consume === true; // Remove stacks when triggered
        this.age = data.age; // For remove effects: trigger this many times before removal
        
        if(data.modifier !== undefined)
           this.modifier = data.modifier;
        if(data.count !== undefined) 
            this.count = data.count;
        if(data.condition !== undefined)
            this.condition = data.condition;
        if(data.chance !== undefined)
            this.chance = data.chance;
    }

    postDataRegistration() {
        super.postDataRegistration();
    }

    /**
     * Resolve which stats source to use based on scaleFrom setting.
     * @param {object} instance - The aura instance
     * @returns {object|Map|null} Stats source for scaling calculation
     */
    _resolveStatsSource(instance) {
        if (!instance) return null;
        
        const scaleFrom = this.scaleFrom || 'source';
        
        switch (scaleFrom) {
            case 'source':
                // Use caster's current stats
                return instance.source;
            case 'target':
                // Use aura holder's current stats
                return instance.auras && instance.auras.character ? instance.auras.character : undefined;
            case 'snapshot':
                // Use stats captured at application time
                return instance.snapshotStats;
            default:
                return instance.source;
        }
    }

    /**
     * Get the amount value for this aura effect.
     * Handles perStack, modifier, and stat scaling.
     * 
     * @param {object} instance - The aura instance (has stacks, source, snapshotStats)
     * @param {string} displayMode - Display mode for formatting
     * @returns {number|string} Calculated amount
     */
    getAmount(instance, displayMode) {
        // Resolve stats source for scaling
        const statsSource = this._resolveStatsSource(instance);
        
        // Get base amount using ScalableEffect's calculation
        let amount = super.getAmount(statsSource, displayMode);
        
        // For raw number mode (no displayMode), apply modifiers
        if (!displayMode) {
            // Apply perStack multiplier
            if (this.perStack && instance) {
                const stackCount = this.getStacks(instance);
                amount = Math.ceil(amount * stackCount);
            }
            
            // Apply legacy modifier
            if (this.modifier) {
                amount = Math.ceil(amount * this.modifier);
            }
        }
        
        return amount;
    }

    /**
     * Get the stacks value for this aura effect.
     * Uses instance stacks, optionally modified by count.
     * 
     * @param {object} instance - The aura instance
     * @param {string} displayMode - Display mode for formatting
     * @returns {number} Stack count
     */
    getStacks(instance, displayMode) {
        if (!instance) return 0;
        
        let stacks = instance.stacks || 0;

        // Apply count modifier if present
        if (this.count) {
            stacks = Math.ceil(stacks * this.count);
        }

        return stacks;
    }
}

export class AdventuringAura extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this._media = data.media;
        this.name = data.name;
        this._descriptionTemplate = data.description; // Template with placeholders
        this.flavorText = data.flavorText; // Optional flavor text
        this.effects = data.effects.map(effect => new AdventuringAuraEffect(this.manager, this.game, this, effect));

        // combineMode: how the aura behaves when reapplied
        // - 'stack': add new stacks to existing (default if stackable)
        // - 'refresh': replace stacks with new value
        // - 'bySource': separate instances per source (ability, character, etc.)
        // - 'separate': always create new instance
        this.combineMode = data.combineMode || (data.stackable ? 'stack' : 'separate');
        
        this.stackable = data.stackable === true; // Whether this aura can have multiple stacks
        this.maxStacks = data.maxStacks; // Optional cap on stack count
        this.hidden = data.hidden === true; // Don't show in aura bar UI

        this.highlight = false;

        this.renderQueue = new AdventuringAuraRenderQueue();
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    onLoad() {
        
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
    }

    getDescription(instance) {
        // If we have a template description, use it with placeholders
        if(this._descriptionTemplate) {
            const replacements = buildEffectReplacements(this.effects, instance, true);
            let desc = parseDescription(this._descriptionTemplate, replacements);
            if(this.flavorText) {
                desc = `${desc}\n\n${this.flavorText}`;
            }
            return desc;
        }
        
        // Filter out standard cleanup effects - the minimal { trigger, type: 'remove' } patterns
        // that are defined on every aura for encounter_end and death
        const isStandardCleanup = (e) => {
            if (e.type !== 'remove') return false;
            if (e.trigger !== 'encounter_end' && e.trigger !== 'death') return false;
            // Standard cleanup only has trigger and type, no other properties
            const keys = Object.keys(e).filter(k => k !== 'trigger' && k !== 'type');
            return keys.length === 0;
        };
        
        const mainEffects = this.effects.filter(e => !isStandardCleanup(e));
        
        // Auto-generate from effects
        const effectDescs = mainEffects.map(effect => {
            const effectObj = {
                type: effect.type,
                trigger: effect.trigger || 'passive',
                amount: effect.getAmount ? effect.getAmount(instance) : (this.amount || 0),
                stacks: effect.getStacks ? effect.getStacks(instance) : (instance !== undefined ? (instance.stacks || 0) : (this.stacks || 0)),
                id: effect.id,
                stat: effect.stat,
                target: effect.target,
                condition: effect.condition
            };
            return describeEffectFull(effectObj, this.manager);
        });
        
        let generated = effectDescs.join('. ');
        if(this.flavorText) {
            generated = generated ? `${generated}.\n\n${this.flavorText}` : this.flavorText;
        }
        return generated || this.name;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
    }

    render() {
        this.renderName();
        this.renderDescription();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.nameText.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderDescription() {
        if(!this.renderQueue.description)
            return;
        
        this.component.description.innerHTML = this.getDescription();

        this.renderQueue.description = false;
    }
}