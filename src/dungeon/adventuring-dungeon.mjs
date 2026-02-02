const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringWeightedTable } = await loadModule('src/core/utils/weighted-table.mjs');
const { EffectCache } = await loadModule('src/core/effects/effect-cache.mjs');
const { createEffect } = await loadModule('src/core/utils/adventuring-utils.mjs');

const { AdventuringCard } = await loadModule('src/ui/adventuring-card.mjs');
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

        this.endlessWave = 0;
        this.endlessFloorIndex = 0;

        this.effectCache = new EffectCache();
        this._setupEffectSources();
    }

    get exploreInterval() { return this.manager.config.timers.explore; }

    _setupEffectSources() {

        this.effectCache.registerSource('difficulty', () => {
            if(this.area === undefined) return [];
            const difficulty = this.area.difficulty;
            return difficulty ? difficulty.getEffects() : [];
        });

        this.effectCache.registerSource('endless', () => {
            if(!this.isEndless || this.endlessWave === 0) return [];

            const scaling = this.waveScaling;
            if(!scaling) return [];

            const statPercent = ((scaling.statPercentPerWave !== undefined) ? scaling.statPercentPerWave : 5) * this.endlessWave;
            const rewardPercent = ((scaling.rewardPercentPerWave !== undefined) ? scaling.rewardPercentPerWave : 2) * this.endlessWave;
            const sourceName = `Endless Wave ${this.endlessWave + 1}`;

            return [
                createEffect({ trigger: 'passive', type: 'all_stat_percent', target: 'all', party: 'enemy', value: statPercent }, [{ type: 'endless', name: sourceName, ref: this }]),
                createEffect({ trigger: 'passive', type: 'xp_percent', value: rewardPercent }, [{ type: 'endless', name: sourceName, ref: this }]),
                createEffect({ trigger: 'passive', type: 'loot_percent', value: rewardPercent }, [{ type: 'endless', name: sourceName, ref: this }])
            ];
        });
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
        const difficulty = this.area.difficulty;
        if (difficulty === undefined) return false;
        return difficulty.isEndless !== undefined ? difficulty.isEndless : false;
    }

    get waveGeneration() {
        if (this.area === undefined) return null;
        const difficulty = this.area.difficulty;
        if (difficulty === undefined) return null;
        return difficulty.waveGeneration !== undefined ? difficulty.waveGeneration : null;
    }

    get waveScaling() {
        if (this.area === undefined) return null;
        const difficulty = this.area.difficulty;
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

                    return floors[this.endlessFloorIndex % floors.length];
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
        if(!this.area) return this.manager.scaleInterval(this.exploreInterval);

        const bonuses = this.area.masteryBonuses;
        const speedMultiplier = Math.max(0.01, 1 - (bonuses.exploreSpeedBonus || 0));
        const baseInterval = Math.max(50, Math.floor(this.exploreInterval * speedMultiplier));
        return Math.max(50, this.manager.scaleInterval(baseInterval));
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
        this.manager.conductor.trigger('tile_explored', { dungeon: this });
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
            this.manager.encounter.startEncounter('boss');
            return;
        }

        if(tile.type.id === 'adventuring:encounter') {
            if(this.area) {
                this.area.addXP(Math.floor(this.getDifficultyXPMultiplier()));
            }
            this.manager.log.add(`Starting random encounter`, { category: 'dungeon_events' });
            this.manager.encounter.generateEncounter();
            this.manager.encounter.startEncounter('encounter');
            return;
        }

        if(!tile.type.activatable)
            return;

        if(this.area) {
            this.area.addXP(Math.floor(this.getDifficultyXPMultiplier()));
        }

        if(tile.type.effects !== undefined) {
            if (this.manager.achievementManager) {
                this.manager.conductor.trigger('special_tile_found', { tileType: tile.type });
            }
            for(let effect of tile.type.effects) {
                this.processTileEffect(effect, tile.type.name);
            }

            if(this.manager.party.combatParty.every(member => member.dead)) {
                this.abandon({ died: true });
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
            this.manager.log.add(`${sourceName} did ${amount} damage to ${member.getDisplayName()}`, {
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
                this.manager.log.add(`${sourceName} revived ${member.getDisplayName()} to ${amount} health.`, {
                    category: 'dungeon_events',
                    target: member
                });
            } else {
                member.heal({ amount: amount });
                this.manager.log.add(`${sourceName} healed ${member.getDisplayName()} for ${amount} health.`, {
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

        const difficulty = area.difficulty;
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
        this.endlessFloorIndex = 0;

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

        this.applyMasteryAuras();

        this.manager.triggerEffects('dungeon_start', {});

        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buffs = true;
        // Fire dungeon_start trigger (achievements + tutorials listen)
        this.manager.conductor.trigger('dungeon_start', {
            area: this.area,
            difficulty: this.difficulty,
            isEndless: this.isEndless
        });

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

    abandon({ died = false } = {}) {
        if(this.manager.encounter.isFighting) {
            this.manager.encounter.all.forEach(member => {
                member.trigger('encounter_end');
            });
            this.manager.encounter.reset();
        }

        // End the run tracking (abandoned or died)
        this.manager.combatTracker.endRun({ completed: false, died });

        // Only disable auto-run when manually abandoning, not when dying
        if (!died) {
            this.manager.setAutoRepeatArea(null);
        }

        if(this.area !== undefined)
            this.manager.log.add(`${died ? 'Died in' : 'Abandoned'} ${this.area.name} on floor ${this.progress+1}`, { category: 'dungeon_progress' });

        // Fire dungeon_end trigger for abandon (consumables, tavern listen)
        this.manager.conductor.trigger('dungeon_end', {
            area: this.area,
            difficulty: this.difficulty,
            isEndless: this.isEndless,
            endlessWave: this.endlessWave,
            abandoned: true,
            died: died
        });

        this.manager.overview.renderQueue.buffs = true;

        this.reset();
        this.manager.stop();

        if(this.active)
            this.manager.town.go();
    }

    complete() {
        this.manager.log.add(`Completed ${this.area.name}`, { category: 'dungeon_progress' });

        if (this.area) {
            this.area.addXP(Math.floor(this.manager.config.xpValues.dungeonComplete * this.getDifficultyXPMultiplier()));
            // Mark area as cleared (for unlock requirements)
            this.manager.crossroads.clearedAreas.add(this.area.id);
        }

        // Check for solo clear
        const noneJob = this.manager.cached.noneJob;
        const activeHeroes = this.manager.party.all.filter(h => h.combatJob && h.combatJob !== noneJob);
        const isSolo = activeHeroes.length === 1;
        
        // Fire dungeon_end trigger (achievements, slayers, tutorials all listen)
        this.manager.conductor.trigger('dungeon_end', {
            area: this.area,
            difficulty: this.difficulty,
            isEndless: this.isEndless,
            endlessWave: this.endlessWave,
            isSolo,
            completed: true,
            abandoned: false,
            died: false
        });
        // Note: slayers, consumables, tavern all listen to dungeon_end via conductor

        this.manager.overview.renderQueue.buffs = true;

        if(!this.manager.party.combatParty.every(hero => hero.dead)) {

            if(this.isEndless) {
                const floors = this.area.floors;
                this.endlessFloorIndex++;
                
                // Only increment wave when completing all floors (boss killed)
                if (this.endlessFloorIndex % floors.length === 0) {
                    this.endlessWave++;
                    this.manager.log.add(`Wave ${this.endlessWave + 1} starting...`, { category: 'dungeon_progress' });

                    this.effectCache.invalidateAll();

                    this.area.updateBestEndlessStreak(this.endlessWave);

                    // Continue endless wave (don't reset run stats)
                    const waveStats = this.manager.combatTracker.run;
                    this.manager.combatTracker.continueEndlessWave();

                    // Fire trigger for endless wave completion
                    this.manager.conductor.trigger('endless_wave', {
                        area: this.area,
                        difficulty: this.difficulty,
                        wave: this.endlessWave,
                        runStats: waveStats,
                        isSolo: waveStats.isSolo
                    });
                } else {
                    const currentFloorNum = (this.endlessFloorIndex % floors.length) + 1;
                    this.manager.log.add(`Floor ${currentFloorNum} of Wave ${this.endlessWave + 1}...`, { category: 'dungeon_progress' });
                }

                this.progress = 0;
                this.next();
                return;
            }

            // End the run tracking (completed successfully)
            const runStats = this.manager.combatTracker.run;
            this.manager.combatTracker.endRun({ completed: true, died: false });

            // Fire trigger for dungeon completion
            this.manager.conductor.trigger('dungeon_end', {
                area: this.area,
                difficulty: this.difficulty,
                runStats: runStats,
                isSolo: runStats.isSolo,
                partySize: runStats.partySize,
                isEndless: this.isEndless,
                endlessWave: this.endlessWave,
                turnsElapsed: runStats.turnsElapsed,
                damageDealt: runStats.damageDealt,
                damageTaken: runStats.damageTaken,
                completed: true,
                abandoned: false,
                died: false
            });

            this.manager.triggerEffects('dungeon_end', {});

            this.manager.log.add(`Auto-repeating ${this.area.name}...`, { category: 'dungeon_progress' });
            this._beginRun();

        } else {

            if(this.isEndless && this.endlessWave > 0) {
                this.manager.log.add(`Endless run ended at Wave ${this.endlessWave + 1}!`, { category: 'dungeon_progress' });
                this.area.updateBestEndlessStreak(this.endlessWave);
            }

            // End the run tracking (completed, no auto-repeat active)
            this.manager.combatTracker.endRun({ completed: true, died: false });

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
        
        // Endless mode state
        writer.writeUint32(this.endlessWave);
        writer.writeUint32(this.endlessFloorIndex);
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
        
        // Endless mode state
        this.endlessWave = reader.getUint32();
        this.endlessFloorIndex = reader.getUint32();
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