const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringWeightedTable, createEffect, EffectCache } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/dungeon/adventuring-dungeon-floor.mjs');

const { AdventuringDungeonElement } = await loadModule('src/dungeon/components/adventuring-dungeon.mjs');

export class AdventuringDungeon extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.progress = 0;

        this.component = createElement('adventuring-dungeon');

        this.floor = new AdventuringDungeonFloor(this.manager, this.game, this);

        this.floor.component.mount(this.component.dungeon);

        this.groupGenerator = new AdventuringWeightedTable(this.manager, this.game);
        this.tileLootGenerator = new AdventuringWeightedTable(this.manager, this.game);

        this.floorCards = [];
        this.numFloors = 0;

        this.tileCount = new Map();

        this.exploreTimer = new Timer('Explore', () => this.explore());
        this.exploreInterval = 1500;

        this.endlessWave = 0;

        this.effectCache = new EffectCache();
        this._setupEffectSources();
    }

    _setupEffectSources() {

        this.effectCache.registerSource('difficulty', () => {
            if(this.area === undefined) return [];
            const difficulty = this.area.getDifficulty();
            return difficulty ? difficulty.getEffects() : [];
        });

        this.effectCache.registerSource('endless', () => {
            if(!this.isEndless || this.endlessWave === 0) return [];

            const scaling = this.waveScaling;
            if(!scaling) return [];

            const statPercent = ((scaling.statPercentPerWave !== undefined) ? scaling.statPercentPerWave : 5) * this.endlessWave;
            const rewardPercent = ((scaling.rewardPercentPerWave !== undefined) ? scaling.rewardPercentPerWave : 2) * this.endlessWave;
            const source = `Endless Wave ${this.endlessWave + 1}`;

            return [
                createEffect({ trigger: 'passive', type: 'all_stat_percent', target: 'all', party: 'enemy', value: statPercent }, this, source, 'endless'),
                createEffect({ trigger: 'passive', type: 'xp_percent', value: rewardPercent }, this, source, 'endless'),
                createEffect({ trigger: 'passive', type: 'loot_percent', value: rewardPercent }, this, source, 'endless')
            ];
        });

        this.effectCache.registerSource('party_enemy_effects', () => {
            return this._gatherPartyEnemyEffects();
        });
    }

    _gatherPartyEnemyEffects() {
        const effects = [];
        if(this.manager === undefined || this.manager.party === undefined) return effects;

        for(const hero of this.manager.party.all) {
            const allEffects = hero.getAllEffects();
            for(const effect of allEffects) {
                if(effect.party === 'enemy') {
                    effects.push(effect);
                }
            }
        }

        // Get consumable effects that target enemies
        if(this.manager.consumables) {
            for(const effect of this.manager.consumables.getEffects({ party: 'enemy' })) {
                effects.push(effect);
            }
        }

        // Get tavern effects that target enemies  
        if(this.manager.tavern) {
            for(const effect of this.manager.tavern.getEffects({ party: 'enemy' })) {
                effects.push(effect);
            }
        }

        return effects;
    }

    getBonus(effectType, filter = {}) {
        return this.effectCache.getBonus(effectType, filter);
    }

    getEffects(filters) {
        return this.effectCache.getEffects(filters);
    }

    getDifficultyXPMultiplier() {
        return 1 + (this.getBonus('xp_percent') / 100);
    }

    get active() {
        if(this.manager.encounter.active)
            return true;
        return super.active;
    }

    get isEndless() {
        if (this.area === undefined) return false;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return false;
        return difficulty.isEndless !== undefined ? difficulty.isEndless : false;
    }

    get waveGeneration() {
        if (this.area === undefined) return null;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return null;
        return difficulty.waveGeneration !== undefined ? difficulty.waveGeneration : null;
    }

    get waveScaling() {
        if (this.area === undefined) return null;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return null;
        return difficulty.waveScaling !== undefined ? difficulty.waveScaling : null;
    }

    get currentFloor() {
        if (this.area === undefined || this.area.floors === undefined || !this.area.floors.length) return undefined;

        const waveGen = this.waveGeneration;
        if (waveGen && waveGen.type === 'infinite') {
            const floors = this.area.floors;
            const selection = waveGen.floorSelection !== undefined ? waveGen.floorSelection : 'first';

            switch (selection) {
                case 'cycle':

                    return floors[this.endlessWave % floors.length];
                case 'random':

                    return floors[Math.floor(Math.random() * floors.length)];
                case 'first':
                default:

                    return floors[0];
            }
        }

        return this.area.floors[Math.max(0, Math.min(this.progress, this.numFloors - 1))];
    }

    go() {
        if(this.manager.encounter.isFighting) {
            this.manager.encounter.go();
        } else {
            super.go();
        }
    }

    onLoad() {
        super.onLoad();
        this.floor.onLoad();
    }

    postDataRegistration() {
        super.postDataRegistration();
        this.floor.postDataRegistration();
    }

    getEffectiveExploreInterval() {
        if(!this.area) return this.exploreInterval;

        const bonuses = this.area.getMasteryBonuses();
        const speedMultiplier = 1 - (bonuses.exploreSpeedBonus || 0);
        return Math.floor(this.exploreInterval * speedMultiplier);
    }

    explore() {
        if(this.manager.timersPaused) {
            this.exploreTimer.start(this.getEffectiveExploreInterval());
            return;
        }

        if(this.manager.encounter.isFighting) {
            this.exploreTimer.start(this.getEffectiveExploreInterval());
            return;
        }
        this.floor.step();
        this.exploreTimer.start(this.getEffectiveExploreInterval());
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    triggerTile(tile) {
        if(tile.type.id === 'adventuring:start') {
            this.manager.log.add(`Starting ${this.area.name} floor ${this.progress+1}`, { category: 'dungeon_progress' });
            return;
        }

        if(tile.type.id === 'adventuring:exit' || tile.type.id === 'adventuring:boss') {
            if(this.area) {
                this.area.addXP(Math.floor(this.getDifficultyXPMultiplier()));
            }
            this.manager.log.add(`Starting floor exit encounter`, { category: 'dungeon_events' });
            this.manager.encounter.generateEncounter(true);
            this.manager.encounter.startEncounter();
            return;
        }

        if(tile.type.id === 'adventuring:encounter') {
            if(this.area) {
                this.area.addXP(Math.floor(this.getDifficultyXPMultiplier()));
            }
            this.manager.log.add(`Starting random encounter`, { category: 'dungeon_events' });
            this.manager.encounter.generateEncounter();
            this.manager.encounter.startEncounter();
            return;
        }

        if(!tile.type.activatable)
            return;

        if(this.area) {
            this.area.addXP(Math.floor(this.getDifficultyXPMultiplier()));
        }

        if(tile.type.effects !== undefined) {
            if (this.manager.achievementManager) {
                this.manager.achievementManager.recordSpecialTile();
            }
            for(let effect of tile.type.effects) {
                this.processTileEffect(effect, tile.type.name);
            }

            if(this.manager.party.combatParty.every(member => member.dead)) {
                this.abandon();
            }
        }
    }

    processTileEffect(effect, sourceName) {
        switch(effect.type) {
            case "damage":
            case "damage_flat":
            case "damage_percent":
                this.processTileDamage(effect, sourceName);
                break;
            case "heal":
            case "heal_flat":
            case "heal_percent":
                this.processTileHeal(effect, sourceName);
                break;
            case "loot":
                this.processTileLoot(effect, sourceName);
                break;
            case "xp":
                this.processTileXP(effect, sourceName);
                break;
        }
    }

    processTileDamage(effect, sourceName) {
        let damagePercent = effect.amount;
        this.manager.party.combatParty.forEach(member => {
            let amount = Math.floor(member.maxHitpoints * damagePercent / 100);
            member.damage({ amount: amount });
            this.manager.log.add(`${sourceName} did ${amount} damage to ${member.name}`, {
                category: 'dungeon_events',
                target: member
            });
        });
    }

    processTileHeal(effect, sourceName) {
        let healPercent = effect.amount;
        this.manager.party.combatParty.forEach(member => {
            let amount = Math.floor(member.maxHitpoints * healPercent / 100);
            if(member.dead) {

                member.revive({ amount: healPercent });
                this.manager.log.add(`${sourceName} revived ${member.name} to ${amount} health.`, {
                    category: 'dungeon_events',
                    target: member
                });
            } else {
                member.heal({ amount: amount });
                this.manager.log.add(`${sourceName} healed ${member.name} for ${amount} health.`, {
                    category: 'dungeon_events',
                    target: member
                });
            }
        });
    }

    processTileLoot(effect, sourceName) {
        this.tileLootGenerator.loadTable(effect.pool);
        let { id, qty } = this.tileLootGenerator.getEntry();
        this.manager.stash.add(id, qty);
        this.manager.log.add(`${sourceName} gave ${qty}x loot!`, { category: 'loot_materials' });
    }

    processTileXP(effect, sourceName) {
        if(effect.job === "adventuring:any") {
            this.manager.party.awardJobXP(effect.amount, { aliveOnly: true });
            this.manager.log.add(`${sourceName} granted ${effect.amount} XP to party!`, { category: 'loot_xp' });
        } else {
            let job = this.manager.jobs.getObjectByID(effect.job);
            if(job !== undefined) {
                job.addXP(effect.amount);
                this.manager.log.add(`${sourceName} granted ${effect.amount} XP!`, { category: 'loot_xp' });
            }
        }
    }

    setArea(area) {
        this.area = area;

        const difficulty = area.getDifficulty();
        if (difficulty && difficulty.waveGeneration && difficulty.waveGeneration.type === 'infinite') {
            this.numFloors = difficulty.waveGeneration.floorsPerWave !== undefined ? difficulty.waveGeneration.floorsPerWave : 1;
        } else {
            this.numFloors = this.area.floors !== undefined ? this.area.floors.length : 1;
        }

        if(this.currentFloor !== undefined)
            this.groupGenerator.loadTable(this.currentFloor.monsters);

        this.effectCache.invalidateAll();
    }

    updateFloorCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        if(this.isEndless) {
            if(this.floorCards[0] === undefined)
                this.floorCards[0] = new AdventuringCard(this.manager, this.game);

            const statBonus = 100 + this.getBonus('all_stat_percent', { target: 'all', party: 'enemy' });
            this.floorCards[0].name = `Wave ${this.endlessWave + 1} (${statBonus}%)`;
            this.floorCards[0].renderQueue.name = true;
            this.floorCards[0].icon = cdnMedia('assets/media/main/hardcore.svg');
            this.floorCards[0].renderQueue.icon = true;
            this.floorCards[0].setFade(false);
            this.floorCards[0].setHighlight(true);
            this.manager.overview.cards.renderQueue.cards.add(this.floorCards[0]);

            if(this.floorCards[1] === undefined)
                this.floorCards[1] = new AdventuringCard(this.manager, this.game);

            const bestStreak = this.area ? this.area.bestEndlessStreak : 0;
            this.floorCards[1].name = `Best: ${bestStreak} waves`;
            this.floorCards[1].renderQueue.name = true;
            this.floorCards[1].icon = cdnMedia('assets/media/main/mastery_header.svg');
            this.floorCards[1].renderQueue.icon = true;
            this.floorCards[1].setFade(false);
            this.floorCards[1].setHighlight(false);
            this.manager.overview.cards.renderQueue.cards.add(this.floorCards[1]);

            this.manager.overview.cards.renderQueue.update = true;
            return;
        }

        for(let i=0; i < this.numFloors; i++) {
            if(this.floorCards[i] === undefined)
                this.floorCards[i] = new AdventuringCard(this.manager, this.game);

            this.floorCards[i].name = (i+1 === this.numFloors ? 'Boss Floor' : `Floor ${i+1}`);
            this.floorCards[i].renderQueue.name = true;

            this.floorCards[i].icon = (i+1 === this.numFloors ? cdnMedia('assets/media/main/hardcore.svg') : cdnMedia('assets/media/skills/combat/combat.svg'));
            this.floorCards[i].renderQueue.icon = true;

            this.floorCards[i].setFade(i < this.progress);
            this.floorCards[i].setHighlight(i === this.progress);

            this.manager.overview.cards.renderQueue.cards.add(this.floorCards[i]);
        }
        this.manager.overview.cards.renderQueue.update = true;
    }

    next() {
        if(this.currentFloor !== undefined)
            this.groupGenerator.loadTable(this.currentFloor.monsters);
        this.floor.generate(this.area.height, this.area.width);

        this.manager.triggerEffects('floor_start', {});

        this.updateFloorCards();
    }

    _beginRun() {
        this.progress = 0;
        this.endlessWave = 0;

        this.effectCache.invalidateAll();

        this.tileCount.clear();
        this.manager.tiles.allObjects.forEach(tile => {
            this.tileCount.set(tile, 0);
        });

        // Initialize CombatTracker for this run
        this.manager.combatTracker.startRun({
            area: this.area,
            difficulty: this.difficulty,
            party: this.manager.party.all
        });

        this.manager.consumables.onDungeonStart();

        this.applyMasteryAuras();

        this.manager.triggerEffects('dungeon_start', {});

        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buffs = true;
        this.manager.tutorialManager.checkTriggers('event', { event: 'dungeonStart' });

        this.next();
    }

    start() {
        this._beginRun();
        this.manager.start();
    }

    applyMasteryAuras() {
        this.manager.areas.allObjects.forEach(area => {
            if(area.masteryAuraUnlocked && area.masteryAura) {

                this.manager.party.combatParty.forEach(member => {
                    if(!member.dead) {
                        member.auras.add(area.masteryAura, { stacks: 1 }, area);
                        member.auras.buildEffects();
                    }
                });
                this.manager.log.add(`${area.name} Mastery Aura activated!`, { category: 'dungeon_progress' });
            }
        });
    }

    reset() {
        this.area = undefined;
        this.numFloors = 0;
        this.progress = 0;
        this.endlessWave = 0;

        this.effectCache.invalidateAll();

        this.manager.overview.renderQueue.turnProgressBar = true;
        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buttons = true;

        this.groupGenerator.reset();
        this.floor.reset();
    }

    abandon() {
        if(this.manager.encounter.isFighting) {
            this.manager.encounter.all.forEach(member => {
                member.trigger('encounter_end');
            });
            this.manager.encounter.reset();
        }

        // End the run tracking (abandoned)
        this.manager.combatTracker.endRun(false);

        if(this.area !== undefined)
            this.manager.log.add(`Abandoned ${this.area.name} on floor ${this.progress+1}`, { category: 'dungeon_progress' });

        this.manager.overview.renderQueue.buffs = true;
        this.manager.consumables.onDungeonEnd();
        this.manager.tavern.consumeCharges();

        this.reset();
        this.manager.stop();

        if(this.active)
            this.manager.town.go();
    }

    complete() {
        this.manager.log.add(`Completed ${this.area.name}`, { category: 'dungeon_progress' });

        if (this.area) {
            this.area.addXP(Math.floor(250 * this.getDifficultyXPMultiplier()));
        }

        this.manager.achievementManager.recordDungeonClear(this.area, this.difficulty, this.isEndless, this.endlessWave);
        this.manager.slayers.onDungeonCleared(this.area);

        this.manager.overview.renderQueue.buffs = true;
        this.manager.consumables.onDungeonEnd();
        this.manager.tavern.consumeCharges();

        if(!this.manager.party.combatParty.every(hero => hero.dead)) {

            if(this.isEndless) {
                this.endlessWave++;
                this.manager.log.add(`Endless Wave ${this.endlessWave + 1} starting...`, { category: 'dungeon_progress' });

                this.effectCache.invalidateAll();

                this.area.updateBestEndlessStreak(this.endlessWave);

                // Continue endless wave (don't reset run stats)
                const waveStats = this.manager.combatTracker.run;
                this.manager.combatTracker.continueEndlessWave();

                // Fire achievement trigger for endless wave completion
                this.manager.achievementManager.trigger('endless_wave', {
                    area: this.area,
                    difficulty: this.difficulty,
                    wave: this.endlessWave,
                    runStats: waveStats,
                    wasFlawless: waveStats.wasFlawless,
                    isSolo: waveStats.isSolo
                });

                this.progress = 0;
                this.next();
                return;
            }

            // End the run tracking (completed successfully)
            const runStats = this.manager.combatTracker.run;
            this.manager.combatTracker.endRun(true);

            // Fire achievement triggers for dungeon completion
            this.manager.achievementManager.trigger('dungeon_end', {
                area: this.area,
                difficulty: this.difficulty,
                runStats: runStats,
                wasFlawless: runStats.wasFlawless,
                isSolo: runStats.isSolo,
                partySize: runStats.partySize,
                isEndless: this.isEndless,
                endlessWave: this.endlessWave,
                turnsElapsed: runStats.turnsElapsed,
                damageDealt: runStats.damageDealt,
                damageTaken: runStats.damageTaken
            });

            this.manager.triggerEffects('dungeon_end', {});

            this.manager.log.add(`Auto-repeating ${this.area.name}...`, { category: 'dungeon_progress' });
            this._beginRun();

        } else {

            if(this.isEndless && this.endlessWave > 0) {
                this.manager.log.add(`Endless run ended at Wave ${this.endlessWave + 1}!`, { category: 'dungeon_progress' });
                this.area.updateBestEndlessStreak(this.endlessWave);
            }

            // End the run tracking (party wiped)
            this.manager.combatTracker.endRun(false);

            this.reset();
            this.manager.stop();
            if(this.active)
                this.manager.crossroads.go();
        }
    }

    render() {
        this.floor.render();
    }

    encode(writer) {
        this.exploreTimer.encode(writer);

        this.floor.encode(writer);

        writer.writeUint32(this.progress);
        writer.writeBoolean(this.area !== undefined);
        if(this.area !== undefined)
            writer.writeNamespacedObject(this.area);
        return writer;
    }

    decode(reader, version) {
        this.exploreTimer.decode(reader, version);
        this.floor.decode(reader, version);
        this.progress = reader.getUint32();
        if (reader.getBoolean()) {
            const area = reader.getNamespacedObject(this.manager.areas);
            if (typeof area === 'string')
                this.setArea(undefined);
            else
                this.setArea(area);
        }
    }

    getErrorLog() {
        let log = `Dungeon:\n`;
        log += `  Area: ${this.area !== undefined ? this.area.id : 'none'}\n`;
        log += `  Progress: ${this.progress}/${this.numFloors}\n`;
        log += `  ExploreTimer Active: ${this.exploreTimer.isActive}\n`;
        log += `  Floor Position: ${this.floor.position}\n`;
        return log;
    }
}