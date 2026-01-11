const { loadModule } = mod.getContext(import.meta);

const { RequirementsChecker, defaultEffectProcessor, buildEffectContext } = await loadModule('src/core/adventuring-utils.mjs');

export class AdventuringTownAction extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        if(data.name !== undefined)
            this.name = data.name;

        if(data.media !== undefined)
            this._media = data.media;

        this._status = data.status;

        this.requirements = data.requirements;
        this.effects = data.effects;
    }

    get status() { // Fix this one day
        if(typeof this._status === "string") {
            return this._status;
        } else {
            if(this._status.length > 0) {
                return this._status[Math.floor(Math.random()*this._status.length)];
            }
        }
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    onLoad() {

    }

    postDataRegistration() {
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
    }

    execute(character, building) {
        this.effects.forEach(effect => {
            const context = {
                character: character,
                manager: this.manager,
                extra: { building, source: character }
            };

            defaultEffectProcessor.processSimple(effect, effect.amount || 0, this.name, context);
        });
    }

    canDo(character) {
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check({ character });
    }
}