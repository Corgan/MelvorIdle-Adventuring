const { loadModule } = mod.getContext(import.meta);

const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { RequirementsChecker, parseDescription, buildEffectReplacements, describeEffectFull, getAuraName, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');

class AdventuringPassiveEffect extends AdventuringScalableEffect {
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
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check();
    }

    unlockedBy(job) {
        if (this._reqChecker === undefined) return false;
        return this._reqChecker.referencesJob(job.id);
    }

    canEquip(character) {
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check({ character });
    }

    /**
     * Get the description with effect values substituted for placeholders
     * If no template provided, auto-generates from effects
     */
    getDescription(character) {
        return buildDescription({
            effects: this.effects,
            manager: this.manager,
            template: this._descriptionTemplate,
            flavorText: this.flavorText,
            stats: character?.stats,
            displayMode: 'total',
            includeTrigger: true,
            buildReplacements: buildEffectReplacements
        });
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
                    this.manager.log.add(`${character.name}'s ${this.name} applies ${getAuraName(this.manager, effect.id)} to ${target.name}`);
                } else if(effect.type === "debuff") {
                    target.debuff(effect.id, builtEffect, character);
                    this.manager.log.add(`${character.name}'s ${this.name} applies ${getAuraName(this.manager, effect.id)} to ${target.name}`);
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

        // Determine which party to use based on explicit party field
        let targetPool;
        if(party === 'ally') {
            targetPool = allies;
        } else if(party === 'enemy') {
            targetPool = enemies;
        } else {
            // Default: buffs go to allies, debuffs go to enemies, self is self
            targetPool = allies;
        }

        switch(target) {
            case "self":
            case undefined:
                return [character];
            case "all":
                return targetPool;
            case "front":
                return targetPool.length > 0 ? [targetPool[0]] : [];
            case "back":
                return targetPool.length > 0 ? [targetPool[targetPool.length - 1]] : [];
            case "lowest":
                return targetPool.length > 0 ? [targetPool.reduce((lowest, c) => c.hitpoints < lowest.hitpoints ? c : lowest)] : [];
            case "random":
                return targetPool.length > 0 ? [targetPool[Math.floor(Math.random() * targetPool.length)]] : [];
            case "dead":
                const deadPool = party === 'ally' ? encounter.manager.party.all.filter(c => c.dead) : encounter.party.all.filter(c => c.dead);
                return deadPool;
            case "attacker":
                // For reactive effects, target the attacker (handled by context)
                return [character];
            default:
                return [character];
        }
    }
}