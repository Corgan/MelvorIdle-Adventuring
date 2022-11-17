const { loadModule } = mod.getContext(import.meta);

const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');

const { AdventuringCharacterUIComponent } = await loadModule('src/components/adventuring-character.mjs');

class AdventuringCharacterRenderQueue {
    constructor() {
        this.name = false;
        this.hitpoints = false;
        this.energy = false;
        this.levels = false;
        this.highlight = false;
        this.generator = false;
        this.spender = false;
        this.splash = false;
    }
}

class AdventuringCharacter {
    constructor(manager, game, party) {
        this.game = game;
        this.manager = manager;
        this.party = party;

        this.component = new AdventuringCharacterUIComponent(this.manager, this.game);

        this.card = new AdventuringCard(this.manager, this.game);

        this.hitpoints = 0;
        this.energy = 0;
        this.dead = false;
        this.highlight = false;
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.hitpoints = true;
        this.renderQueue.energy = true;
        this.renderQueue.levels = true;

        if(this.generator === undefined) // Default to None
            this.setGenerator(undefined);
        this.renderQueue.generator = true;
        
        if(this.spender === undefined) // Default to None
            this.setSpender(undefined);
        this.renderQueue.spender = true;
    }

    // Defence gives Shield at the start of each encounter
    // Agility determines speed and evasion
    // 

    get maxHitpoints() {
        let max = 10 * this.levels.Hitpoints;
        return max;
    }

    get maxEnergy() {
        if(this.spender !== undefined && this.spender.cost > 0)
            return this.spender.cost;
        return 0;
    }

    get hitpointsPercent() {
        let pct = (Math.max(0, Math.min(this.maxHitpoints, this.hitpoints)) / this.maxHitpoints);
        return 100 * (!isNaN(pct) ? pct : 0);
    }

    get energyPercent() {
        let pct = (Math.max(0, Math.min(this.maxEnergy, this.energy)) / this.maxEnergy);
        return 100 * (!isNaN(pct) ? pct : 0);
    }

    get action() {
        if(this.spender.cost !== undefined && this.energy >= this.spender.cost)
            return this.spender;
        return this.generator;
    }

    setGenerator(generator) {
        if(generator === undefined)
            generator = this.manager.generators.getObjectByID('adventuring:none');

        this.generator = generator;
        this.renderQueue.generator = true;
    }

    setSpender(spender) {
        if(spender === undefined)
            spender = this.manager.spenders.getObjectByID('adventuring:none');

        this.spender = spender;
        this.renderQueue.spender = true;
        this.renderQueue.energy = true;
    }

    applyEffect(effectType, amount) {
        if(effectType == "damage")
            this.damage(amount);
        if(effectType == "heal")
            this.heal(amount);
    }

    damage(amount) {
        this.hitpoints -= amount;

        if(!loadingOfflineProgress) {
            this.component.splash.add({
                source: 'Attack',
                amount: -amount,
                xOffset: this.hitpointsPercent,
            });
        }

        if(this.hitpoints <= 0) {
            this.hitpoints = 0;
            this.setEnergy(0);
            if(!this.dead) {
                this.dead = true;
                this.onDeath();
            }
        }
        this.renderQueue.hitpoints = true;
    }

    heal(amount) {
        if(this.dead || this.hitpoints == this.maxHitpoints)
            return;

        this.hitpoints += amount;

        if(!loadingOfflineProgress) {
            this.component.splash.add({
                source: 'Heal',
                amount: amount,
                xOffset: this.hitpointsPercent,
            });
        }

        if(this.hitpoints >= this.maxHitpoints)
            this.hitpoints = this.maxHitpoints;
        
        this.renderQueue.hitpoints = true;
    }

    revive(percent=1) {
        if(!this.dead)
            return;

        this.dead = false;
        this.hitpoints = Math.floor(this.maxHitpoints * percent);
        this.setEnergy(0);
        this.renderQueue.hitpoints = true;
    }

    addEnergy(amount) {
        this.energy += amount;
        if(this.energy > this.maxEnergy)
            this.energy = this.maxEnergy;
        this.renderQueue.energy = true;
    }

    removeEnergy(amount) {
        this.energy -= amount;
        if(this.energy < 0)
            this.energy = 0;
        this.renderQueue.energy = true;
    }

    setEnergy(amount) {
        this.energy = amount;
        if(this.energy > this.maxEnergy)
            this.energy = this.maxEnergy;
        if(this.energy < 0)
            this.energy = 0;
        this.renderQueue.energy = true;
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;

        this.renderQueue.generator = true;
        this.renderQueue.spender = true;
    }

    onDeath() {
        
    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderHighlight();
        this.renderHitpoints();
        this.renderSplash();
        this.renderEnergy();
        this.renderLevels();
        this.renderGenerator();
        this.renderSpender();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.name.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.media;

        this.renderQueue.icon = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

//        this.component.styling.classList.toggle('bg-combat-menu-selected', this.highlight);

        this.renderQueue.highlight = false;
    }

    renderSplash() {
        if(this.component.splash.queue.length == 0)
            return;
        
        this.component.splash.render();
    }

    renderHitpoints() {
        if(!this.renderQueue.hitpoints)
            return;
        
        this.component.hitpoints.textContent = this.hitpoints;
        this.component.maxHitpoints.textContent = this.maxHitpoints;
        this.component.hitpointsProgress.setFixedPosition(this.hitpointsPercent);

        this.renderQueue.hitpoints = false;
    }

    renderEnergy() {
        if(!this.renderQueue.energy)
            return;
        
        this.component.energy.textContent = this.energy;
        this.component.maxEnergy.textContent = this.maxEnergy;
        this.component.energyProgress.setFixedPosition((this.energy / this.maxEnergy) * 100);

        this.renderQueue.energy = false;
    }

    renderLevels() {
        if(!this.renderQueue.levels)
            return;
        
        Object.entries(this.component.levels.skills).forEach(([skill, text]) => {
            text.textContent = this.levels[skill];
        });

        this.renderQueue.levels = false;
    }

    renderGenerator() {
        if(!this.renderQueue.generator)
            return;

        this.component.generator.name.textContent = this.generator.name;
        this.component.generator.tooltip.setContent(this.generator.getDescription(this.levels));
        this.component.generator.styling.classList.toggle('bg-combat-menu-selected', this.generator === this.action && this.highlight);

        this.renderQueue.generator = false;
    }

    renderSpender() {
        if(!this.renderQueue.spender)
            return;

        this.component.spender.name.textContent = this.spender.name;
        this.component.spender.tooltip.setContent(this.spender.getDescription(this.levels));
        this.component.spender.styling.classList.toggle('bg-combat-menu-selected', this.spender === this.action && this.highlight);

        this.renderQueue.spender = false;
    }

    encode(writer) {
        writer.writeBoolean(this.dead);
        writer.writeUint32(this.hitpoints);
        writer.writeUint32(this.energy);
        writer.writeNamespacedObject(this.generator);
        writer.writeNamespacedObject(this.spender);
        return writer;
    }

    decode(reader, version) {
        this.dead = reader.getBoolean();
        this.hitpoints = reader.getUint32();
        this.energy = reader.getUint32();

        const generator = reader.getNamespacedObject(this.manager.generators);
        if (typeof generator === 'string')
            this.setGenerator(undefined);
        else
            this.setGenerator(generator);

        const spender = reader.getNamespacedObject(this.manager.spenders);
        if (typeof spender === 'string')
            this.setSpender(undefined);
        else
            this.setSpender(spender);
    }
}

export { AdventuringCharacter, AdventuringCharacterRenderQueue };