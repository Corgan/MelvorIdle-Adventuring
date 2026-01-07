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

        // Endless mode wave counter (difficulty is set via area)
        this.endlessWave = 0;
        
        // Effect cache for dungeon-level effects (difficulty, endless, party effects targeting enemies)
        this.effectCache = new EffectCache();
        this._setupEffectSources();
    }
    
    /**
     * Set up effect sources for the dungeon effect cache
     */
    _setupEffectSources() {
        // Difficulty effects (stat/xp/loot bonuses, floor_end heals, enemy_spawn buffs)
        this.effectCache.registerSource('difficulty', () => {
            if(this.area === undefined) return [];
            const difficulty = this.area.getDifficulty();
            return difficulty ? difficulty.getEffects() : [];
        });
        
        // Endless mode wave scaling (additive percentages)
        this.effectCache.registerSource('endless', () => {
            if(!this.isEndless || this.endlessWave === 0) return [];
            
            const scaling = this.waveScaling;
            if(!scaling) return [];
            
            const statPercent = (scaling.statPercentPerWave ?? 5) * this.endlessWave;
            const rewardPercent = (scaling.rewardPercentPerWave ?? 2) * this.endlessWave;
            const source = `Endless Wave ${this.endlessWave + 1}`;
            
            return [
                createEffect({ trigger: 'passive', type: 'all_stat_percent', target: 'all', party: 'enemy', value: statPercent }, this, source),
                createEffect({ trigger: 'passive', type: 'xp_percent', value: rewardPercent }, this, source),
                createEffect({ trigger: 'passive', type: 'loot_percent', value: rewardPercent }, this, source)
            ];
        });
        
        // Party effects that target enemies (future: equipment with "enemies take 5% more damage")
        this.effectCache.registerSource('party_enemy_effects', () => {
            return this._gatherPartyEnemyEffects();
        });
    }
    
    /**
     * Gather effects from party members that target enemies
     */
    _gatherPartyEnemyEffects() {
        const effects = [];
        if(this.manager === undefined || this.manager.party === undefined) return effects;
        
        // Collect from all party members
        for(const hero of this.manager.party.all) {
            const allEffects = hero.getAllEffects();
            for(const effect of allEffects) {
                if(effect.party === 'enemy') {
                    effects.push(effect);
                }
            }
        }
        
        // Collect from consumables
        if(this.manager.consumables) {
            for(const effect of this.manager.consumables.getEffects()) {
                if(effect.party === 'enemy') {
                    effects.push(effect);
                }
            }
        }
        
        return effects;
    }
    
    /**
     * Get bonus value for a passive effect type (additive stacking)
     * @param {string} effectType - Effect type (e.g., 'stats_percent', 'xp_percent')
     * @param {Object} [filter={}] - Optional filter for effect properties (e.g., { target: 'all', party: 'enemy' })
     * @returns {number} Total bonus percentage
     */
    getBonus(effectType, filter = {}) {
        return this.effectCache.getBonus(effectType, filter);
    }
    
    /**
     * Get effects for a specific trigger
     * @param {string} trigger - Trigger type (e.g., 'floor_end', 'enemy_spawn')
     * @returns {Array} Effects for that trigger
     */
    getEffectsForTrigger(trigger) {
        return this.effectCache.getEffects(trigger);
    }

    get active() {
        if(this.manager.encounter.active)
            return true;
        return super.active;
    }

    /**
     * Check if auto-repeat is currently available for this area
     * Uses the manager's autoRepeatArea setting
     */
    get canAutoRepeat() {
        return this.area && this.area === this.manager.autoRepeatArea && this.area.autoRepeatUnlocked;
    }

    /**
     * Check if currently in endless mode based on area difficulty
     */
    get isEndless() {
        if (this.area === undefined) return false;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return false;
        return difficulty.isEndless !== undefined ? difficulty.isEndless : false;
    }

    /**
     * Get the wave generation configuration from the current difficulty
     */
    get waveGeneration() {
        if (this.area === undefined) return null;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return null;
        return difficulty.waveGeneration !== undefined ? difficulty.waveGeneration : null;
    }

    /**
     * Get the wave scaling configuration from the current difficulty
     */
    get waveScaling() {
        if (this.area === undefined) return null;
        const difficulty = this.area.getDifficulty();
        if (difficulty === undefined) return null;
        return difficulty.waveScaling !== undefined ? difficulty.waveScaling : null;
    }

    /**
     * Get the current floor based on difficulty's floor selection strategy
     * For infinite modes, floors are selected based on waveGeneration.floorSelection
     */
    get currentFloor() {
        if (this.area === undefined || this.area.floors === undefined || !this.area.floors.length) return undefined;
        
        const waveGen = this.waveGeneration;
        if (waveGen && waveGen.type === 'infinite') {
            const floors = this.area.floors;
            const selection = waveGen.floorSelection !== undefined ? waveGen.floorSelection : 'first';
            
            switch (selection) {
                case 'cycle':
                    // Rotate through all floors based on wave number
                    return floors[this.endlessWave % floors.length];
                case 'random':
                    // Random floor each wave (seeded by wave for consistency)
                    return floors[Math.floor(Math.random() * floors.length)];
                case 'first':
                default:
                    // Always use first floor
                    return floors[0];
            }
        }
        
        // Standard mode: use progress-based floor selection
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

    /**
     * Get effective explore interval with Dungeon Mastery speed bonus
     */
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
        this.floor.step();
        this.exploreTimer.start(this.getEffectiveExploreInterval());
        this.manager.overview.renderQueue.turnProgressBar = true;
    }

    triggerTile(tile) {
        if(tile.type.id === 'adventuring:start') {
            this.manager.log.add(`Starting ${this.area.name} floor ${this.progress+1}`);
            return;
        }
        
        if(tile.type.id === 'adventuring:exit' || tile.type.id === 'adventuring:boss') {
            this.manager.log.add(`Starting floor exit encounter`);
            this.manager.encounter.generateEncounter(true);
            this.manager.encounter.startEncounter();
            return;
        }

        if(tile.type.id === 'adventuring:encounter') {
            this.manager.log.add(`Starting random encounter`);
            this.manager.encounter.generateEncounter();
            this.manager.encounter.startEncounter();
            return;
        }

        if(!tile.type.activatable)
            return;
        
        if(tile.type.effects !== undefined) {
            for(let effect of tile.type.effects) {
                this.processTileEffect(effect, tile.type.name);
            }
            
            // Check for party wipe after all effects
            if(this.manager.party.all.every(member => member.dead)) {
                this.abandon();
            }
        }
    }

    /**
     * Process a single tile effect - centralizes tile effect handling
     * @param {object} effect - The effect data from tile definition
     * @param {string} sourceName - Name of the tile for logging
     */
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

    /**
     * Process tile damage effect
     * Note: effect.amount is whole percent (10 = 10% of max HP)
     */
    processTileDamage(effect, sourceName) {
        let damagePercent = effect.amount;
        this.manager.party.all.forEach(member => {
            let amount = Math.floor(member.maxHitpoints * damagePercent / 100);
            member.damage({ amount: amount });
            this.manager.log.add(`${sourceName} did ${amount} damage to ${member.name}`);
        });
    }

    /**
     * Process tile heal effect (including revive)
     * Note: effect.amount is whole percent (20 = 20% of max HP)
     */
    processTileHeal(effect, sourceName) {
        let healPercent = effect.amount;
        this.manager.party.all.forEach(member => {
            let amount = Math.floor(member.maxHitpoints * healPercent / 100);
            if(member.dead) {
                // Pass the percent directly to revive (it expects whole percent)
                member.revive({ amount: healPercent });
                this.manager.log.add(`${sourceName} revived ${member.name} to ${amount} health.`);
            } else {
                member.heal({ amount: amount });
                this.manager.log.add(`${sourceName} healed ${member.name} for ${amount} health.`);
            }
        });
    }

    /**
     * Process tile loot effect
     */
    processTileLoot(effect, sourceName) {
        this.tileLootGenerator.loadTable(effect.pool);
        let { id, qty } = this.tileLootGenerator.getEntry();
        this.manager.stash.add(id, qty);
        this.manager.log.add(`${sourceName} gave ${qty}x loot!`);
    }

    /**
     * Process tile XP effect
     */
    processTileXP(effect, sourceName) {
        if(effect.job === "adventuring:any") {
            // Grant XP to all living party members' combat jobs
            this.manager.party.all.filter(member => !member.dead).forEach(member => {
                if(member.combatJob && member.combatJob.isMilestoneReward) {
                    member.combatJob.addXP(effect.amount);
                }
            });
            this.manager.log.add(`${sourceName} granted ${effect.amount} XP to party!`);
        } else {
            let job = this.manager.jobs.getObjectByID(effect.job);
            if(job !== undefined) {
                job.addXP(effect.amount);
                this.manager.log.add(`${sourceName} granted ${effect.amount} XP!`);
            }
        }
    }

    setArea(area) {
        this.area = area;
        
        // For infinite modes, numFloors represents floors per wave
        // For standard modes, numFloors is the total floor count
        const difficulty = area.getDifficulty();
        if (difficulty && difficulty.waveGeneration && difficulty.waveGeneration.type === 'infinite') {
            this.numFloors = difficulty.waveGeneration.floorsPerWave !== undefined ? difficulty.waveGeneration.floorsPerWave : 1;
        } else {
            this.numFloors = this.area.floors !== undefined ? this.area.floors.length : 1;
        }

        if(this.currentFloor !== undefined)
            this.groupGenerator.loadTable(this.currentFloor.monsters);
        
        // Invalidate effect cache when area changes (new difficulty)
        this.effectCache.invalidateAll();
    }

    updateFloorCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        // In endless mode, show wave counter instead of floor list
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
            
            // Show best streak
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

        // Use centralized trigger system for floor_start
        // This handles both party-scoped and character-scoped effects
        this.manager.triggerEffects('floor_start', {});

        this.updateFloorCards();
    }

    start() {
        this.progress = 0;
        this.endlessWave = 0;
        
        // Invalidate and rebuild effect cache for the new run
        this.effectCache.invalidateAll();
        
        this.tileCount.clear();
        this.manager.tiles.allObjects.forEach(tile => {
            this.tileCount.set(tile, 0);
        });

        // Initialize consumable state for dungeon start
        this.manager.consumables.onDungeonStart();

        // Apply mastery auras from all level 99 dungeons
        this.applyMasteryAuras();
        
        // Use centralized trigger system for dungeon_start
        this.manager.triggerEffects('dungeon_start', {});

        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buffs = true;
        this.next();
        this.manager.start();

        // Trigger tutorial for first dungeon
        this.manager.tutorialManager.checkTriggers('event', { event: 'dungeonStart' });
    }
    
    /**
     * Apply mastery auras from all dungeons that have reached level 99
     * These provide passive bonuses for the entire dungeon run
     */
    applyMasteryAuras() {
        this.manager.areas.allObjects.forEach(area => {
            if(area.masteryAuraUnlocked && area.masteryAura) {
                // Apply aura to all party members
                this.manager.party.all.forEach(member => {
                    if(!member.dead) {
                        member.auras.add(area.masteryAura, { stacks: 1 }, area);
                        member.auras.buildEffects();
                    }
                });
                this.manager.log.add(`${area.name} Mastery Aura activated!`);
            }
        });
    }

    reset() {
        this.area = undefined;
        this.numFloors = 0;
        this.progress = 0;
        this.endlessWave = 0;
        
        // Invalidate effect cache on reset
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
                let resolvedEffects = member.trigger('encounter_end');
            });
            this.manager.encounter.reset();
        }
        
        if(this.area !== undefined)
            this.manager.log.add(`Abandoned ${this.area.name} on floor ${this.progress+1}`);

        // Consume charges from equipped consumables and tavern drinks
        this.manager.consumables.onDungeonEnd();

        this.reset();
        this.manager.stop();
        this.manager.overview.renderQueue.buffs = true;

        if(this.active)
            this.manager.town.go();
    }

    complete() {
        this.manager.log.add(`Completed ${this.area.name}`);
        
        // Area mastery XP from clears (not kills)
        // Calculate XP based on area difficulty/level
        if (this.area) {
            const areaLevel = this.area.level || 1;
            const areaXP = Math.floor(areaLevel * 10);  // 10 XP per area level on clear
            this.area.addXP(areaXP);
        }

        // Track dungeon clear for Slayer tasks
        this.manager.slayers.onDungeonCleared(this.area);

        // Track dungeon clear for Achievements
        if(this.manager.achievementManager) {
            const difficulty = this.difficulty ? this.difficulty.id.replace('adventuring:', '') : 'normal';
            this.manager.achievementManager.recordDungeonClear(
                this.area, 
                difficulty, 
                this.isEndless, 
                this.endlessWave
            );
        }

        // Consume charges from equipped consumables
        this.manager.consumables.onDungeonEnd();
        this.manager.overview.renderQueue.buffs = true;

        if(!this.manager.party.all.every(hero => hero.dead)) {
            // Handle endless mode - continue to next wave
            if(this.isEndless) {
                this.endlessWave++;
                this.manager.log.add(`Endless Wave ${this.endlessWave + 1} starting...`);
                
                // Invalidate effect cache for new wave scaling
                this.effectCache.invalidateAll();
                
                // Update best streak if this is a new record
                this.area.updateBestEndlessStreak(this.endlessWave);
                
                // Reset progress and continue with scaled difficulty
                this.progress = 0;
                this.next();
                return;
            }
            
            // Trigger dungeon_end effects
            this.manager.triggerEffects('dungeon_end', {});
            
            // Check if we should auto-repeat or go back to town
            if(this.canAutoRepeat) {
                this.start();
            } else {
                // Dungeon complete, return to town
                this.manager.log.add(`Returning to town...`);
                this.reset();
                this.manager.stop();
                if(this.active)
                    this.manager.town.go();
            }
        } else {
            // Party wiped - check for endless mode record
            if(this.isEndless && this.endlessWave > 0) {
                this.manager.log.add(`Endless run ended at Wave ${this.endlessWave + 1}!`);
                this.area.updateBestEndlessStreak(this.endlessWave);
            }
            
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