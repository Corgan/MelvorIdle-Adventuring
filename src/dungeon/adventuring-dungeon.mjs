const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringWeightedTable, createEffect } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');
const { AdventuringDungeonFloor } = await loadModule('src/dungeon/adventuring-dungeon-floor.mjs');

const { AdventuringDungeonElement } = await loadModule('src/dungeon/components/adventuring-dungeon.mjs');

/**
 * DungeonEffectCache - Caches and precompiles dungeon-level effects
 * 
 * Sources:
 * - Difficulty effects (stat/xp/loot multipliers, enemy buffs/debuffs, party buffs)
 * - Endless mode scaling
 * - Party effects that target enemies (future)
 * 
 * Precompiled values for fast runtime access:
 * - enemyStatMultiplier
 * - xpMultiplier  
 * - lootMultiplier
 * - enemySpawnEffects (debuffs/buffs to apply to enemies)
 * - partyStartEffects (buffs to apply to party at dungeon start)
 */
class DungeonEffectCache {
    constructor(dungeon) {
        this.dungeon = dungeon;
        this.dirty = true;
        
        // Raw effect arrays
        this.cachedEffects = [];
        
        // Precompiled multipliers (computed once per cache rebuild)
        this.enemyStatMultiplier = 1.0;
        this.xpMultiplier = 1.0;
        this.lootMultiplier = 1.0;
        
        // Precompiled effect lists by trigger type (Map for centralized access)
        this.effectsByTrigger = new Map();
    }
    
    /**
     * Mark cache as dirty - will rebuild on next access
     */
    invalidate() {
        this.dirty = true;
    }
    
    /**
     * Rebuild the cache from all sources
     */
    rebuild() {
        this.cachedEffects = [];
        
        // 1. Gather difficulty effects
        const difficulty = this.dungeon.area !== undefined ? this.dungeon.area.getDifficulty() : undefined;
        if(difficulty) {
            this.cachedEffects.push(...difficulty.getEffects());
        }
        
        // 2. Gather endless mode effects
        if(this.dungeon.isEndless && this.dungeon.endlessWave > 0) {
            const statMult = this.dungeon.getEndlessStatMultiplier();
            const rewardMult = this.dungeon.getEndlessRewardMultiplier();
            
            this.cachedEffects.push(createEffect({
                trigger: 'passive',
                type: 'enemy_stat_multiplier',
                value: statMult
            }, this.dungeon, `Endless Wave ${this.dungeon.endlessWave + 1}`));
            
            this.cachedEffects.push(createEffect({
                trigger: 'passive',
                type: 'xp_multiplier',
                value: rewardMult
            }, this.dungeon, `Endless Wave ${this.dungeon.endlessWave + 1}`));
            
            this.cachedEffects.push(createEffect({
                trigger: 'passive',
                type: 'loot_multiplier',
                value: rewardMult
            }, this.dungeon, `Endless Wave ${this.dungeon.endlessWave + 1}`));
        }
        
        // 3. Gather party effects that target enemies
        // e.g., equipment with "enemies take 5% more damage"
        this.gatherPartyEnemyEffects();
        
        // Precompile multipliers (multiply all sources together)
        this.precompileMultipliers();
        
        // Precompile effect lists by trigger
        this.precompileEffectLists();
        
        this.dirty = false;
    }
    
    /**
     * Precompile multipliers from effects
     */
    precompileMultipliers() {
        this.enemyStatMultiplier = 1.0;
        this.xpMultiplier = 1.0;
        this.lootMultiplier = 1.0;
        
        for(const effect of this.cachedEffects) {
            if(effect.type === 'enemy_stat_multiplier') {
                this.enemyStatMultiplier *= effect.value;
            } else if(effect.type === 'xp_multiplier') {
                this.xpMultiplier *= effect.value;
            } else if(effect.type === 'loot_multiplier') {
                this.lootMultiplier *= effect.value;
            }
        }
    }
    
    /**
     * Precompile effect lists by trigger for fast application
     * All effects are stored in a Map keyed by trigger type
     */
    precompileEffectLists() {
        this.effectsByTrigger = new Map();
        
        for(const effect of this.cachedEffects) {
            const trigger = effect.trigger;
            if(!trigger || trigger === 'passive') continue; // Skip passive effects (handled by multipliers)
            
            if(!this.effectsByTrigger.has(trigger)) {
                this.effectsByTrigger.set(trigger, []);
            }
            this.effectsByTrigger.get(trigger).push(effect);
        }
    }
    
    /**
     * Gather effects from party members that target enemies.
     * These include equipment and consumable effects with target: all_enemies, etc.
     */
    gatherPartyEnemyEffects() {
        const manager = this.dungeon.manager;
        if(manager === undefined || manager.party === undefined) return;
        
        // Collect effects from all party members
        for(const hero of manager.party.all) {
            const allEffects = hero.getAllEffects();
            
            for(const effect of allEffects) {
                // Check if this effect targets enemies
                const target = effect.target;
                if(!target) continue;
                
                const isEnemyTarget = target === 'all_enemies' || 
                                      target === 'random_enemy' ||
                                      target === 'front_enemy' ||
                                      target === 'back_enemy' ||
                                      target === 'lowest_enemy';
                
                if(!isEnemyTarget) continue;
                
                // Add to cached effects for later application
                this.cachedEffects.push(effect);
            }
        }
        
        // Also gather from consumables
        if(manager.consumables) {
            const consumableEffects = manager.consumables.getEffects();
            for(const effect of consumableEffects) {
                const target = effect.target;
                if(!target) continue;
                
                const isEnemyTarget = target === 'all_enemies' || 
                                      target === 'random_enemy' ||
                                      target === 'front_enemy' ||
                                      target === 'back_enemy' ||
                                      target === 'lowest_enemy';
                
                if(!isEnemyTarget) continue;
                
                this.cachedEffects.push(effect);
            }
        }
    }
    
    /**
     * Ensure cache is valid before access
     */
    ensureValid() {
        if(this.dirty) {
            this.rebuild();
        }
    }
    
    /**
     * Get all cached effects, optionally filtered by trigger
     */
    getEffects(trigger) {
        this.ensureValid();
        if(trigger) {
            return this.cachedEffects.filter(e => e.trigger === trigger);
        }
        return this.cachedEffects;
    }
    
    /**
     * Get precompiled enemy stat multiplier
     */
    getEnemyStatMultiplier() {
        this.ensureValid();
        return this.enemyStatMultiplier;
    }
    
    /**
     * Get precompiled XP multiplier
     */
    getXPMultiplier() {
        this.ensureValid();
        return this.xpMultiplier;
    }
    
    /**
     * Get precompiled loot multiplier
     */
    getLootMultiplier() {
        this.ensureValid();
        return this.lootMultiplier;
    }
    
    /**
     * Get precompiled effects for a specific trigger type
     * @param {string} trigger - The trigger type (e.g., 'floor_end', 'enemy_spawn', 'dungeon_start')
     * @returns {Array} Array of effects for that trigger, or empty array if none
     */
    getEffectsForTrigger(trigger) {
        this.ensureValid();
        return this.effectsByTrigger.get(trigger) || [];
    }
    
    /**
     * Get precompiled enemy spawn effects (ready to apply)
     * @deprecated Use getEffectsForTrigger('enemy_spawn') instead
     */
    getEnemySpawnEffects() {
        return this.getEffectsForTrigger('enemy_spawn');
    }
    
    /**
     * Get precompiled party start effects (ready to apply)
     * @deprecated Use getEffectsForTrigger('dungeon_start') instead
     */
    getPartyStartEffects() {
        return this.getEffectsForTrigger('dungeon_start');
    }
    
    /**
     * Get precompiled floor end effects (ready to apply)
     * @deprecated Use getEffectsForTrigger('floor_end') instead
     */
    getFloorEndEffects() {
        return this.getEffectsForTrigger('floor_end');
    }
}

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
        this.effectCache = new DungeonEffectCache(this);
    }

    /**
     * @deprecated Use manager.triggerEffects() instead - moved to Adventuring class
     * Kept for backwards compatibility
     */
    triggerEffects(trigger, context = {}) {
        return this.manager.triggerEffects(trigger, context);
    }
    
    /**
     * @deprecated Use manager.applyEffect() instead - moved to Adventuring class
     * Kept for backwards compatibility
     */
    applyEffect(effect, context = {}) {
        return this.manager.applyEffect(effect, effect.trigger || 'unknown', context);
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
     * Get stat multiplier for wave-scaling difficulties based on current wave
     * Uses waveScaling.statPercentPerWave (whole percent, e.g., 5 = +5% per wave)
     */
    getEndlessStatMultiplier() {
        const scaling = this.waveScaling;
        if(!scaling) return 1.0;
        const perWave = (scaling.statPercentPerWave !== undefined ? scaling.statPercentPerWave : 5) / 100;
        return 1.0 + (this.endlessWave * perWave);
    }

    /**
     * Get XP/loot multiplier for wave-scaling difficulties based on current wave
     * Uses waveScaling.rewardPercentPerWave (whole percent, e.g., 2 = +2% per wave)
     */
    getEndlessRewardMultiplier() {
        const scaling = this.waveScaling;
        if(!scaling) return 1.0;
        const perWave = (scaling.rewardPercentPerWave !== undefined ? scaling.rewardPercentPerWave : 2) / 100;
        return 1.0 + (this.endlessWave * perWave);
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
                this.processTileDamage(effect, sourceName);
                break;
            case "heal":
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
        this.effectCache.invalidate();
    }

    updateFloorCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        // In endless mode, show wave counter instead of floor list
        if(this.isEndless) {
            if(this.floorCards[0] === undefined)
                this.floorCards[0] = new AdventuringCard(this.manager, this.game);
            
            const statMult = Math.round(this.getEndlessStatMultiplier() * 100);
            this.floorCards[0].name = `Wave ${this.endlessWave + 1} (${statMult}%)`;
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
        this.manager.triggerEffects('floor_start', {});

        // Apply consumable effects at floor start
        this.manager.consumables.onFloorStart();

        this.updateFloorCards();
    }

    start() {
        this.progress = 0;
        this.endlessWave = 0;
        
        // Invalidate and rebuild effect cache for the new run
        this.effectCache.invalidate();
        
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
     * Apply difficulty effects at dungeon start
     * @deprecated Use triggerEffects('dungeon_start') instead - kept for backwards compatibility
     */
    applyDifficultyEffects() {
        // Now handled by centralized triggerEffects() method
        // This method is kept for backwards compatibility but does nothing
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
        this.effectCache.invalidate();
        
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
                this.effectCache.invalidate();
                
                // Update best streak if this is a new record
                this.area.updateBestEndlessStreak(this.endlessWave);
                
                // Reset progress and continue with scaled difficulty
                this.progress = 0;
                this.next();
                return;
            }
            
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