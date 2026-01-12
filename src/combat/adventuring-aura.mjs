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

class AdventuringAuraEffect extends AdventuringScalableEffect {
    constructor(manager, game, aura, data) {

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

    _resolveStatsSource(instance) {
        if (!instance) return null;

        const scaleFrom = this.scaleFrom || 'source';

        switch (scaleFrom) {
            case 'source':

                return instance.source;
            case 'target':

                return instance.auras && instance.auras.character ? instance.auras.character : undefined;
            case 'snapshot':

                return instance.snapshotStats;
            default:
                return instance.source;
        }
    }

    getAmount(instance, displayMode) {

        const statsSource = this._resolveStatsSource(instance);

        let amount = super.getAmount(statsSource, displayMode);

        if (!displayMode) {

            if (this.perStack && instance) {
                const stackCount = this.getStacks(instance);
                amount = Math.ceil(amount * stackCount);
            }

            if (this.modifier) {
                amount = Math.ceil(amount * this.modifier);
            }
        }

        return amount;
    }

    getStacks(instance, displayMode) {
        if (!instance) return 0;

        let stacks = instance.stacks || 0;

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

        if(this._descriptionTemplate) {
            const replacements = buildEffectReplacements(this.effects, instance, true);
            let desc = parseDescription(this._descriptionTemplate, replacements);
            if(this.flavorText) {
                desc = `${desc}\n\n${this.flavorText}`;
            }
            return desc;
        }


        const shouldDescribe = (e) => e.describe !== false;

        const mainEffects = this.effects.filter(e => shouldDescribe(e));

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