const { loadModule } = mod.getContext(import.meta);

const { ScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { RequirementsChecker, parseDescription, buildEffectReplacements, describeEffectFull } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringPassiveEffect extends ScalableEffect {
    constructor(manager, game, passive, data) {
        super(manager, game, data);
        this.passive = passive;
        this.trigger = data.trigger;
    }
}

export class AdventuringPassive extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;
        this.name = data.name;
        this._descriptionTemplate = data.description; // Template with placeholders
        this.flavorText = data.flavorText; // Optional flavor text
        this.requirements = data.requirements || [];
        this.effects = (data.effects || []).map(effect => new AdventuringPassiveEffect(this.manager, this.game, this, effect));
    }

    postDataRegistration() {
        this.effects.forEach(effect => effect.postDataRegistration());
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
    }

    get unlocked() {
        return this._reqChecker?.check() ?? true;
    }

    unlockedBy(job) {
        return this._reqChecker?.referencesJob(job.id) ?? false;
    }

    canEquip(character) {
        return this._reqChecker?.check({ character }) ?? true;
    }

    /**
     * Get the description with effect values substituted for placeholders
     * If no template provided, auto-generates from effects
     */
    getDescription(character) {
        // If we have a template description, use it with placeholders
        if(this._descriptionTemplate) {
            const replacements = buildEffectReplacements(this.effects, character?.stats, true);
            let desc = parseDescription(this._descriptionTemplate, replacements);
            if(this.flavorText) {
                desc = `${desc}\n\n${this.flavorText}`;
            }
            return desc;
        }
        
        // Auto-generate from effects
        const effectDescs = this.effects.map(effect => {
            const effectObj = {
                type: effect.type,
                trigger: effect.trigger || 'passive',
                value: effect.getAmount ? effect.getAmount(character?.stats, true) : (effect.amount?.base || effect.amount || 0),
                stacks: effect.getStacks ? effect.getStacks(character?.stats, true) : (effect.stacks?.base || effect.stacks || 0),
                id: effect.id,
                target: effect.target,
                condition: effect.condition,
                chance: effect.chance
            };
            return describeEffectFull(effectObj, this.manager);
        });
        
        let generated = effectDescs.join('. ');
        if(this.flavorText) {
            generated = generated ? `${generated}.\n\n${this.flavorText}` : this.flavorText;
        }
        return generated || 'No effect.';
    }

    // Apply this passive's effects to a character
    // encounter provides access to both parties for targeting
    apply(character, triggerType, encounter) {
        this.effects.forEach(effect => {
            if(effect.trigger !== triggerType)
                return;
            
            let builtEffect = {
                amount: effect.getAmount(character),
                stacks: effect.getStacks(character)
            };

            // Resolve targets based on effect.target and effect.party
            let targets = this.resolveTargets(effect, character, encounter);

            targets.forEach(target => {
                if(target.dead)
                    return;
                    
                if(effect.type === "buff") {
                    target.buff(effect.id, builtEffect, character);
                    this.manager.log.add(`${character.name}'s ${this.name} applies ${this.manager.auras.getObjectByID(effect.id)?.name || effect.id} to ${target.name}`);
                } else if(effect.type === "debuff") {
                    target.debuff(effect.id, builtEffect, character);
                    this.manager.log.add(`${character.name}'s ${this.name} applies ${this.manager.auras.getObjectByID(effect.id)?.name || effect.id} to ${target.name}`);
                } else if(effect.type === "heal") {
                    target.heal(builtEffect, character);
                    this.manager.log.add(`${character.name}'s ${this.name} heals ${target.name} for ${builtEffect.amount}`);
                } else if(effect.type === "damage") {
                    target.damage(builtEffect, character);
                    this.manager.log.add(`${character.name}'s ${this.name} deals ${builtEffect.amount} damage to ${target.name}`);
                }
            });
        });
    }

    // Resolve target string to array of characters
    resolveTargets(effect, character, encounter) {
        if(!encounter) return [character]; // fallback if no encounter context
        
        const allies = encounter.manager.party.all.filter(c => !c.dead);
        const enemies = encounter.party.all.filter(c => !c.dead);
        
        const target = effect.target;
        const party = effect.party; // 'ally' or 'enemy'

        // Determine which party to use based on explicit party or target suffix
        let targetPool;
        if(party === 'ally') {
            targetPool = allies;
        } else if(party === 'enemy') {
            targetPool = enemies;
        } else if(target?.endsWith('_ally')) {
            targetPool = allies;
        } else if(target?.endsWith('_enemy')) {
            targetPool = enemies;
        } else {
            // Default: buffs go to allies, debuffs go to enemies, self is self
            targetPool = allies;
        }

        // Extract the base target type (remove _ally/_enemy suffix)
        const baseTarget = target?.replace(/_ally$|_enemy$/, '') || 'self';

        switch(baseTarget) {
            case "self":
            case undefined:
                return [character];
            case "all":
            case "all_allies":
            case "all_enemies":
            case "aoe_ally":
            case "aoe_enemy":
            case "aoe":
                return targetPool;
            case "front":
            case "front_ally":
            case "front_enemy":
                return targetPool.length > 0 ? [targetPool[0]] : [];
            case "lowest":
            case "lowest_ally":
            case "lowest_enemy":
                return targetPool.length > 0 ? [targetPool.reduce((lowest, c) => c.hitpoints < lowest.hitpoints ? c : lowest)] : [];
            case "random":
            case "random_ally":
            case "random_enemy":
                return targetPool.length > 0 ? [targetPool[Math.floor(Math.random() * targetPool.length)]] : [];
            default:
                return [character];
        }
    }
}