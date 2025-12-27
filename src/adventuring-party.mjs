const { loadModule } = mod.getContext(import.meta);

const { AdventuringHero } = await loadModule('src/adventuring-hero.mjs');
const { AdventuringEnemy } = await loadModule('src/adventuring-enemy.mjs');
const { AdventuringPartyElement } = await loadModule('src/components/adventuring-party.mjs');

class AdventuringParty {
    constructor(manager, game) {
        this.game = game;
        this.manager = manager;
        
        this.component = createElement('adventuring-party');
    }

    get all() {
        return [this.front, this.center, this.back];
    }

    /** Get all alive party members */
    get alive() {
        return this.all.filter(member => !member.dead);
    }

    /** Get all dead party members */
    get dead() {
        return this.all.filter(member => member.dead);
    }

    /** Set locked state for all party members */
    setAllLocked(locked) {
        this.all.forEach(member => member.setLocked(locked));
    }

    onLoad() {
        this.all.forEach(member => member.onLoad());
    }

    render() {
        this.back.render();
        this.center.render();
        this.front.render();
    }

    postDataRegistration() {
        
    }

    encode(writer) {
        this.back.encode(writer);
        this.center.encode(writer);
        this.front.encode(writer);
        return writer;
    }

    decode(reader, version) {
        this.back.decode(reader, version);
        this.center.decode(reader, version);
        this.front.decode(reader, version);
    }

    getErrorLog() {
        let log = `Party:\n`;
        this.all.forEach((member, i) => {
            log += `  [${i}] ${member.name}: HP=${member.hitpoints}/${member.maxHitpoints}, Energy=${member.energy}/${member.maxEnergy}, Dead=${member.dead}\n`;
        });
        return log;
    }
}

class AdventuringHeroParty extends AdventuringParty {
    constructor(manager, game) {
        super(manager, game);

        this.front = new AdventuringHero(this.manager, this.game, this);
        this.center = new AdventuringHero(this.manager, this.game, this);
        this.back = new AdventuringHero(this.manager, this.game, this);

        this.back.component.mount(this.component.party);
        this.center.component.mount(this.component.party);
        this.front.component.mount(this.component.party);
    }

    postDataRegistration() {
        super.postDataRegistration();
        this.all.forEach(member => member.postDataRegistration());
    }
}

class AdventuringEnemyParty extends AdventuringParty {
    constructor(manager, game) {
        super(manager, game);

        this.front = new AdventuringEnemy(this.manager, this.game, this);
        this.center = new AdventuringEnemy(this.manager, this.game, this);
        this.back = new AdventuringEnemy(this.manager, this.game, this);

        this.front.component.mount(this.component.party);
        this.center.component.mount(this.component.party);
        this.back.component.mount(this.component.party);
    }
}

export { AdventuringHeroParty, AdventuringEnemyParty }