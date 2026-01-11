const { loadModule } = mod.getContext(import.meta);

const { AdventuringScalableEffect } = await loadModule('src/combat/adventuring-scalable-effect.mjs');
const { RequirementsChecker, buildEffectReplacements, buildDescription } = await loadModule('src/core/adventuring-utils.mjs');

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

    getDescription(character) {
        return buildDescription({
            effects: this.effects,
            manager: this.manager,
            template: this._descriptionTemplate,
            flavorText: this.flavorText,
            stats: character ? character.stats : undefined,
            displayMode: 'total',
            includeTrigger: true,
            buildReplacements: buildEffectReplacements
        });
    }
}