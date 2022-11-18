const { loadModule } = mod.getContext(import.meta);

const { AdventuringCharacter, AdventuringCharacterRenderQueue } = await loadModule('src/adventuring-character.mjs');
const { AdventuringEquipment } = await loadModule('src/adventuring-equipment.mjs');

class AdventuringHeroRenderQueue extends AdventuringCharacterRenderQueue {
    constructor() {
        super(...arguments);
        this.job = false;
    }
}

export class AdventuringHero extends AdventuringCharacter {
    constructor(manager, game, party) {
        super(manager, game, party);
        this.baseLevels = {
            Hitpoints: 10,
            Defence: 1,
            Agility: 1,
            Attack: 1,
            Strength: 1,
            Ranged: 1,
            Magic: 1,
            Prayer: 1
        };

        this.levels = {
            Hitpoints: 0,
            Defence: 0,
            Agility: 0,
            Attack: 0,
            Strength: 0,
            Ranged: 0,
            Magic: 0,
            Prayer: 0
        }

        this.locked = false;
        this.equipment = new AdventuringEquipment(manager, game, this);

        this.component.equipment.classList.remove('d-none');
        this.equipment.component.mount(this.component.equipment);

        this.component.generator.attachSelector(this, 'generator');
        this.component.spender.attachSelector(this, 'spender');

        this.renderQueue = new AdventuringHeroRenderQueue();
    }

    get media() {
        if(this.job)
            return this.job.media;
        return cdnMedia('assets/media/main/question.svg');
    }

    onLoad() {
        super.onLoad();

        if(this.job === undefined) // Default to None
            this.setJob(this.manager.jobs.getObjectByID('adventuring:none'));
        this.renderQueue.job = true;

        if(this.generator.id == 'adventuring:none')
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));

        if(this.spender.id == 'adventuring:none')
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.equipment.onLoad();

        this.calculateLevels();
            
        if(this.name === undefined) { // New game :)
            this.name = this.getRandomName(this.manager.party.all.map(member => member.name));
            this.renderQueue.name = true;

            this.hitpoints = this.maxHitpoints;
            this.renderQueue.hitpoints = true;
        }
        
        this.card.setName(this.name);
        this.card.setIcon(this.media);
    }

    calculateLevels() {
        let shouldAdjust = true;
        if(this.manager.isActive || this.hitpoints > this.maxHitpoints) // Loading Shenanigans
            shouldAdjust = false;
        let hitpointPct = this.hitpoints / this.maxHitpoints;

        let adjustedLevels = Object.entries(this.baseLevels).map(([skill, level]) => {
            let adjustedLevel = level;
            if(this.job && this.job.levels[skill] !== undefined)
                adjustedLevel += this.job.levels[skill];
            if(this.equipment.levels[skill] !== undefined)
                adjustedLevel += this.equipment.levels[skill];
            return [skill, adjustedLevel];
        });

        this.levels = Object.fromEntries(adjustedLevels);

        if(shouldAdjust)
            this.hitpoints = Math.min(this.maxHitpoints, Math.floor(this.maxHitpoints * hitpointPct));

        this.renderQueue.levels = true;
        this.renderQueue.hitpoints = true;

        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    setLocked(locked) {
        this.locked = locked;
        this.renderQueue.jobs = true;
        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    setName(name) {
        this.name = name;
        this.renderQueue.name = true;
        this.card.setName(this.name);
    }

    setJob(job) {
        this.job = job;
        this.calculateLevels();

        if(!this.generator.canEquip(this))
            this.setGenerator(this.manager.generators.getObjectByID('adventuring:slap'));
        
        if(!this.spender.canEquip(this))
            this.setSpender(this.manager.spenders.getObjectByID('adventuring:backhand'));

        this.renderQueue.name = true;
        this.renderQueue.icon = true;

        this.equipment.slots.forEach(slot => slot.renderQueue.valid = true);

        this.card.setIcon(this.media);

        this.manager.party.all.forEach(member => member.renderQueue.jobs = true);
    }
    
    render() {
        super.render();
        this.renderJobs();

        this.equipment.render();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.name.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderJobs() {
        if(!this.renderQueue.jobs)
            return;
        this.component.job.clearOptions();
        this.manager.availableJobs.forEach(job => {
            if(job.unlocked)
                this.component.job.addOption([createElement('span', { text: job.name })], () => this.setJob(job));
        });

        this.component.job.setButtonText(this.job.name);

        this.component.jobDropdown.classList.toggle('invisible', this.locked);

        this.renderQueue.jobs = false;
    }

    renderGenerator() {
        if(!this.renderQueue.generator)
            return;

        this.component.generator.name.textContent = this.generator.name;
        this.component.generator.tooltip.setContent(this.generator.getDescription(this.levels));
        this.component.generator.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-inner-dark', this.locked);
        this.component.generator.styling.classList.toggle('bg-combat-menu-selected', this.generator === this.action && this.highlight);

        this.renderQueue.generator = false;
    }

    renderSpender() {
        if(!this.renderQueue.spender)
            return;

        this.component.spender.name.textContent = this.spender.name;
        this.component.spender.tooltip.setContent(this.spender.getDescription(this.levels));
        this.component.spender.styling.classList.toggle('pointer-enabled', !this.locked);
        this.component.spender.styling.classList.toggle('bg-combat-inner-dark', this.locked);
        this.component.spender.styling.classList.toggle('bg-combat-menu-selected', this.spender === this.action && this.highlight);

        this.renderQueue.spender = false;
    }

    getRandomName(exclude=[]) {
        let names = [
            "Frea",
            "Pasa",
            "Charchel",
            "Ridtom",
            "Terda",
            "Cynsa",
            "Danald",
            "Kaar",
            "Swithbert",
            "Wil",
            "Holesc",
            "Trini",
            "Wardi",
            "Ardi",
            "Georever",
            "Berbrand",
            "Tolpher",
            "Tim-ke",
            "Fridles",
            "Arpher"
        ].filter(name => !exclude.includes(name));

        return names[Math.floor(Math.random()*names.length)];
    }

    postDataRegistration() {
        this.equipment.postDataRegistration();
    }
    
    encode(writer) {
        super.encode(writer);
        writer.writeString(this.name);
        writer.writeNamespacedObject(this.job);
        this.equipment.encode(writer);
        return writer;
    }

    decode(reader, version) {
        super.decode(reader, version);
        this.name = reader.getString();
        const job = reader.getNamespacedObject(this.manager.jobs);
        if (typeof job === 'string')
            this.setJob(undefined);
        else
            this.setJob(job);
        this.equipment.decode(reader, version);
    }
}