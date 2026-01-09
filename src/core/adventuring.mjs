const { loadModule } = mod.getContext(import.meta);

const { AdventuringStat } = await loadModule('src/core/adventuring-stat.mjs');
const { AdventuringBuilding } = await loadModule('src/town/adventuring-building.mjs');
const { AdventuringTownAction } = await loadModule('src/town/adventuring-town-action.mjs');
const { AdventuringProduct } = await loadModule('src/ui/adventuring-product.mjs');
const { AdventuringJob } = await loadModule('src/progression/adventuring-job.mjs');
const { AdventuringGenerator } = await loadModule('src/dungeon/adventuring-generator.mjs');
const { AdventuringSpender } = await loadModule('src/town/adventuring-spender.mjs');
const { AdventuringPassive } = await loadModule('src/progression/adventuring-passive.mjs');
const { AdventuringBuff } = await loadModule('src/combat/adventuring-buff.mjs');
const { AdventuringDebuff } = await loadModule('src/combat/adventuring-debuff.mjs');
const { AdventuringArea } = await loadModule('src/dungeon/adventuring-area.mjs');
const { AdventuringDifficulty } = await loadModule('src/dungeon/adventuring-difficulty.mjs');
const { AdventuringMonster } = await loadModule('src/entities/adventuring-monster.mjs');
const { AdventuringDungeonTile } = await loadModule('src/dungeon/adventuring-dungeon-tile.mjs');
const { AdventuringSlayerTaskType, AdventuringRewardType } = await loadModule('src/progression/adventuring-slayer-task.mjs');
const { AdventuringAchievementCategory, AdventuringAchievement, AchievementManager } = await loadModule('src/progression/adventuring-achievements.mjs');

const { AdventuringOverview } = await loadModule('src/ui/adventuring-overview.mjs');
const { AdventuringMessageLog } = await loadModule('src/ui/adventuring-message-log.mjs');

const { AdventuringPages } = await loadModule('src/ui/adventuring-pages.mjs');
const { AdventuringHeroParty, AdventuringEnemyParty } = await loadModule('src/entities/adventuring-party.mjs');

const { AdventuringTown } = await loadModule('src/town/adventuring-town.mjs');

const { AdventuringTrainer } = await loadModule('src/town/adventuring-trainer.mjs');
const { AdventuringJobDetails } = await loadModule('src/progression/adventuring-job-details.mjs');

const { AdventuringArmory } = await loadModule('src/items/adventuring-armory.mjs');
const { AdventuringTavern } = await loadModule('src/town/adventuring-tavern.mjs');
const { AdventuringTavernDrink } = await loadModule('src/town/adventuring-tavern-drink.mjs');
const { AdventuringSlayers } = await loadModule('src/progression/adventuring-slayers.mjs');
const { AdventuringLemons } = await loadModule('src/town/adventuring-lemons.mjs');
const { AdventuringConsumables } = await loadModule('src/items/adventuring-consumables.mjs');
const { AdventuringConsumable } = await loadModule('src/items/adventuring-consumable.mjs');

const { AdventuringStash } = await loadModule('src/town/adventuring-stash.mjs');
const { AdventuringBestiary } = await loadModule('src/entities/adventuring-bestiary.mjs');
const { AdventuringMonsterDetails } = await loadModule('src/entities/adventuring-monster-details.mjs');
const { AdventuringCrossroads } = await loadModule('src/dungeon/adventuring-crossroads.mjs');
const { AdventuringDungeon } = await loadModule('src/dungeon/adventuring-dungeon.mjs');
const { AdventuringEncounter } = await loadModule('src/combat/adventuring-encounter.mjs');

const { AdventuringItemSlot } = await loadModule('src/items/adventuring-item-slot.mjs');
const { AdventuringItemType } = await loadModule('src/items/adventuring-item-type.mjs');
const { AdventuringItemBase } = await loadModule('src/items/adventuring-item-base.mjs');
const { AdventuringMaterial } = await loadModule('src/items/adventuring-material.mjs');
const { AdventuringMaterialCategory } = await loadModule('src/items/adventuring-material-category.mjs');
const { AdventuringConsumableCategory } = await loadModule('src/items/adventuring-consumable-category.mjs');
const { AdventuringMasteryCategory } = await loadModule('src/progression/adventuring-mastery-category.mjs');

const { AdventuringTutorial } = await loadModule('src/ui/adventuring-tutorial.mjs');
const { AdventuringTutorialManager } = await loadModule('src/ui/adventuring-tutorial-manager.mjs');
const { AdventuringEquipmentSet } = await loadModule('src/items/adventuring-equipment-set.mjs');
const { AdventuringEquipmentPool } = await loadModule('src/items/adventuring-equipment-pool.mjs');
const { AdventuringLootTable } = await loadModule('src/items/adventuring-loot-table.mjs');
const { AdventuringModifiers } = await loadModule('src/core/adventuring-modifiers.mjs');
const { AdventuringGrimoire } = await loadModule('src/slayer/adventuring-grimoire.mjs');

const { AdventuringPageElement } = await loadModule('src/core/components/adventuring.mjs');

class AdventuringRenderQueue extends MasterySkillRenderQueue {
    constructor() {
        super(...arguments);
    }
}

export class Adventuring extends SkillWithMastery {
    constructor(namespace, game) {
        super(namespace, 'Adventuring', game);
        this.version = 5;
        this.saveVersion = -1;
        this._media = 'melvor:assets/media/main/adventure.svg';
        this.renderQueue = new AdventuringRenderQueue();
        this.isActive = false;
        this.timersPaused = false; // Used by tutorial system to pause exploration/combat

        // Event system for loose coupling between components
        this._eventHandlers = new Map();

        // Blue Mage (Slayer) learned abilities
        this.learnedAbilities = new Set();
        
        // Track which abilities have been seen in picker (for NEW badge)
        this.seenAbilities = new Set();

        this.stats = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buildings = new NamespaceRegistry(this.game.registeredNamespaces);
        this.townActions = new NamespaceRegistry(this.game.registeredNamespaces);
        this.products = new NamespaceRegistry(this.game.registeredNamespaces);
        this.jobs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.generators = new NamespaceRegistry(this.game.registeredNamespaces);
        this.spenders = new NamespaceRegistry(this.game.registeredNamespaces);
        this.passives = new NamespaceRegistry(this.game.registeredNamespaces);
        this.auras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.buffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.debuffs = new NamespaceRegistry(this.game.registeredNamespaces);
        this.areas = new NamespaceRegistry(this.game.registeredNamespaces);
        this.difficulties = new NamespaceRegistry(this.game.registeredNamespaces);
        this.dungeonAuras = new NamespaceRegistry(this.game.registeredNamespaces);
        this.monsters = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tiles = new NamespaceRegistry(this.game.registeredNamespaces);
        this.slayerTaskTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.rewardTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievementCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.achievements = new NamespaceRegistry(this.game.registeredNamespaces);
        
        // Achievement system (manager.achievements)
        this.achievementManager = new AchievementManager(this, game);

        this.itemSlots = new NamespaceRegistry(this.game.registeredNamespaces);
        this.itemTypes = new NamespaceRegistry(this.game.registeredNamespaces);

        this.materials = new NamespaceRegistry(this.game.registeredNamespaces);
        this.materialCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.baseItems = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableTypes = new NamespaceRegistry(this.game.registeredNamespaces);
        this.consumableCategories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.tavernDrinks = new NamespaceRegistry(this.game.registeredNamespaces);
        this.categories = new NamespaceRegistry(this.game.registeredNamespaces);
        this.equipmentSets = new NamespaceRegistry(this.game.registeredNamespaces);
        this.equipmentPools = new NamespaceRegistry(this.game.registeredNamespaces);
        this.lootTables = new NamespaceRegistry(this.game.registeredNamespaces);
        this.masteryCategories = new NamespaceRegistry(this.game.registeredNamespaces);

        // Tutorial system
        this.tutorials = new NamespaceRegistry(this.game.registeredNamespaces);

        this.component = createElement('adventuring-page');

        this.overview = new AdventuringOverview(this, this.game);
        this.overview.component.mount(this.component.overview);

        this.log = new AdventuringMessageLog(this, this.game);
        this.log.component.mount(this.overview.component.log);

        this.party = new AdventuringHeroParty(this, this.game);
        this.party.component.mount(this.component.party);

        this.pages = new AdventuringPages(this, this.game);

        this.town = new AdventuringTown(this, this.game);

        this.trainer = new AdventuringTrainer(this, this.game);
        this.jobdetails = new AdventuringJobDetails(this, this.game);

        this.armory = new AdventuringArmory(this, this.game);
        this.tavern = new AdventuringTavern(this, this.game);
        this.slayers = new AdventuringSlayers(this, this.game);
        this.lemons = new AdventuringLemons(this, this.game);
        this.consumables = new AdventuringConsumables(this, this.game);

        this.stash = new AdventuringStash(this, this.game);
        this.bestiary = new AdventuringBestiary(this, this.game);
        this.monsterdetails = new AdventuringMonsterDetails(this, this.game);
        this.grimoire = new AdventuringGrimoire(this, this.game);
        this.crossroads = new AdventuringCrossroads(this, this.game);
        this.dungeon = new AdventuringDungeon(this, this.game);
        this.encounter = new AdventuringEncounter(this, this.game);

        // Tutorial manager (after all pages created)
        this.tutorialManager = new AdventuringTutorialManager(this, this.game);

        // Centralized modifier system
        this.modifiers = new AdventuringModifiers(this, this.game);


        this.pages.register('town', this.town);

        this.pages.register('trainer', this.trainer);
        this.pages.register('jobdetails', this.jobdetails);

        this.pages.register('armory', this.armory);
        this.pages.register('tavern', this.tavern);
        this.pages.register('slayers', this.slayers);
        this.pages.register('lemons', this.lemons);
        this.pages.register('consumables', this.consumables);

        this.pages.register('stash', this.stash);
        this.pages.register('bestiary', this.bestiary);
        this.pages.register('monsterdetails', this.monsterdetails);
        this.pages.register('crossroads', this.crossroads);
        this.pages.register('dungeon', this.dungeon);
        this.pages.register('encounter', this.encounter);

        this.townTimer = new Timer('Town', () => this.nextTownTick());
        this.townInterval = 5000;

        // Auto-repeat target area (only one at a time)
        this.autoRepeatArea = null;
    }

    /**
     * Set which area is the auto-repeat target
     * Only one area can be auto-repeat at a time
     */
    setAutoRepeatArea(area) {
        const previousArea = this.autoRepeatArea;
        this.autoRepeatArea = area;
        
        // Queue re-render for all areas that have auto-repeat unlocked
        this.areas.allObjects.forEach(a => {
            if(a.autoRepeatUnlocked) {
                a.renderQueue.autoRepeat = true;
            }
        });
        
        if(area) {
            this.log.add(`Auto-run set to ${area.name}`);
        } else if(previousArea) {
            this.log.add(`Auto-run disabled`);
        }
    }

    // =========================================
    // Event System
    // =========================================

    /**
     * Subscribe to an event
     * @param {string} event - Event name (e.g., 'consumable:equipped', 'dungeon:started')
     * @param {Function} handler - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, handler) {
        if(!this._eventHandlers.has(event)) {
            this._eventHandlers.set(event, []);
        }
        this._eventHandlers.get(event).push(handler);
        
        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} handler - Handler to remove
     */
    off(event, handler) {
        const handlers = this._eventHandlers.get(event);
        if(handlers) {
            const idx = handlers.indexOf(handler);
            if(idx > -1) handlers.splice(idx, 1);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} event - Event name
     * @param {*} [data] - Optional data to pass to handlers
     */
    emit(event, data) {
        const handlers = this._eventHandlers.get(event);
        if(handlers) {
            handlers.forEach(fn => {
                try {
                    fn(data);
                } catch(e) {
                    console.error(`Error in event handler for '${event}':`, e);
                }
            });
        }
    }

    /**
     * Subscribe to an event for one-time handling
     * @param {string} event - Event name
     * @param {Function} handler - Callback function
     * @returns {Function} Unsubscribe function
     */
    once(event, handler) {
        const wrappedHandler = (data) => {
            this.off(event, wrappedHandler);
            handler(data);
        };
        return this.on(event, wrappedHandler);
    }

    /**
     * Clear all event handlers (called on reset)
     */
    clearAllEvents() {
        this._eventHandlers.clear();
    }

    /**
     * Get list of registered events (for debugging)
     * @returns {string[]}
     */
    getRegisteredEvents() {
        return Array.from(this._eventHandlers.keys());
    }

    reset() {
        // Clear event handlers
        this.clearAllEvents();

        // Reset party members to initial state
        this.party.forEach(member => {
            member.hitpoints = member.maxHitpoints;
            member.energy = 0;
            member.dead = false;
            member.auras.clear();
        });

        // Reset stash
        this.stash.reset();

        // Reset bestiary
        this.bestiary.reset();

        // Reset dungeon state
        this.dungeon.reset();

        // Reset encounter state
        this.encounter.reset();

        // Stop all timers
        if (this.townTimer.isActive)
            this.townTimer.stop();
        if (this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        if (this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
        if (this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        // Reset active state
        this.isActive = false;
    }
    
    /**
     * Full skill reset - resets all progression to initial state (like starting a new save).
     * This is different from reset() which just resets combat/dungeon state.
     */
    resetSkill() {
        // First, do the regular combat/dungeon reset
        this.reset();
        
        // Stop any ongoing activities
        if (this.townTimer.isActive)
            this.townTimer.stop();
        
        // Reset skill XP and mastery
        this._xp = 0;
        this.masteryPoolXP = 0;
        this.actionMastery.forEach((data, action) => {
            data.xp = 0;
        });
        
        // Clear learned abilities (Blue Mage)
        this.learnedAbilities.clear();
        
        // Clear seen abilities
        this.seenAbilities.clear();
        
        // Reset auto-repeat
        this.autoRepeatArea = null;
        
        // Reset armory - clear all item unlocks and upgrades
        this.armory.unlocked.clear();
        this.armory.viewed.clear();
        this.armory.upgradeLevels.forEach((level, item) => {
            this.armory.upgradeLevels.set(item, 0);
        });
        this.armory.clearSelected();
        
        // Reset stash - clear all materials (stash.reset() clears materialCounts and unlocked)
        this.stash.reset();
        this.materials.allObjects.forEach(material => {
            material.renderQueue.updateAll();
        });
        
        // Reset tavern - clear active drinks
        this.tavern.resetDrinks();
        
        // Reset consumables
        this.consumables.resetCharges();
        
        // Reset slayer tasks
        this.slayers.resetTasks();
        
        // Reset lemons
        this.lemons.resetStats();
        
        // Reset achievements
        this.achievementManager.resetAll();
        
        // Reset grimoire (learned monster abilities)
        this.grimoire.resetAll();
        
        // Reset tutorial state
        this.tutorialManager.resetState();
        
        // Reset bestiary
        this.bestiary.reset();
        
        // Reset areas - mastery XP reset above handles autoRepeatUnlocked (computed from mastery)
        this.areas.allObjects.forEach(area => {
            area.renderQueue.updateAll();
        });
        
        // Reset heroes
        this.party.forEach(hero => {
            // Clear name so onLoad detects as new player
            hero.name = undefined;
            
            // Reset jobs to none
            hero.setCombatJob(this.jobs.getObjectByID('adventuring:none'));
            hero.setPassiveJob(this.jobs.getObjectByID('adventuring:none'));
            
            // Reset abilities to default
            hero.setGenerator(this.generators.getObjectByID('adventuring:slap'));
            hero.setSpender(this.spenders.getObjectByID('adventuring:backhand'));
            
            // Clear equipment
            hero.equipment.slots.forEach(slot => {
                slot.setEmpty();
            });
            
            // Reset character state
            hero.dead = false;
            hero.energy = 0;
            hero.auras.clear();
            
            // Reset stats
            hero.stats.reset();
            this.stats.allObjects.forEach(stat => {
                if(stat.base !== undefined)
                    hero.stats.set(stat, stat.base);
            });
            
            // Reset hitpoints will be done after calculateStats
        });
        
        // Recalculate stats for all heroes
        this.party.forEach(hero => {
            hero.calculateStats();
            hero.hitpoints = hero.maxHitpoints;
        });
        
        // Apply starter loadouts (job, gear, abilities)
        this.party.forEach(hero => {
            hero._applyStarterLoadout();
        });
        
        // Trigger re-render
        this.jobs.allObjects.forEach(job => job.renderQueue.updateAll());
        this.areas.allObjects.forEach(area => area.renderQueue.updateAll());
        this.baseItems.allObjects.forEach(item => item.renderQueue.updateAll());
        this.monsters.allObjects.forEach(monster => monster.renderQueue.updateAll());
        this.materials.allObjects.forEach(material => material.renderQueue.updateAll());
        this.tavernDrinks.allObjects.forEach(drink => drink.renderQueue.updateAll());
        this.consumableTypes.allObjects.forEach(consumable => consumable.renderQueue.updateAll());
        this.party.forEach(hero => hero.renderQueue.updateAll());
        
        // Go back to town
        this.town.go();
        
        this.log.add('Skill has been reset to initial state.');
    }

    // =========================================
    // Centralized Effect Trigger System
    // =========================================
    
    /**
     * Centralized trigger system - fires effects from ALL sources for a given trigger
     * Sources include:
     * - Party member auras
     * - Dungeon effectCache (difficulty effects, endless scaling, etc.)
     * 
     * @param {string} trigger - The trigger type (e.g., 'floor_end', 'floor_start', 'dungeon_start')
     * @param {Object} context - Optional context data passed to effects
     */
    triggerEffects(trigger, context = {}) {
        // 1. Party-scoped effects (scope: 'party') - fire once for party
        if(this.party) {
            this.party.trigger(trigger, context);
        }
        
        // 2. Character-scoped effects - fire for each party member
        if(this.party) {
            this.party.forEach(member => {
                member.trigger(trigger, context);
            });
        }
        
        // 3. Apply dungeon-level effects from effectCache
        if(this.dungeon && this.dungeon.effectCache) {
            const effects = this.dungeon.getEffectsForTrigger(trigger);
            for(const effect of effects) {
                this.applyEffect(effect, trigger, context);
            }
        }
    }
    
    /**
     * Apply a single effect from the effect cache
     * Handles all effect types in a centralized way
     * 
     * @param {Object} effect - The effect to apply
     * @param {string} trigger - The trigger that caused this effect
     * @param {Object} context - Optional context data
     */
    applyEffect(effect, trigger, context = {}) {
        switch(effect.type) {
            case 'heal_percent': {
                // Use 'amount' for percent of max HP for heal_percent/heal_party
                const healPercent = effect.amount || 0;
                let healAmount = 0;
                if (effect.amount && typeof effect.amount === 'object' && effect.amount.base !== undefined) {
                    healAmount = effect.amount.base;
                } else if (effect.amount !== undefined) {
                    healAmount = effect.amount;
                }
                
                // Determine targets based on party property
                // 'enemy' targets enemies, 'hero'/'ally' targets the hero party
                // In non-combat context (like floor_end), 'ally' defaults to hero party
                const targetParty = effect.party === 'enemy' ? null : this.party.all;
                if(!targetParty) break; // heal_percent with party: 'enemy' not applicable here
                
                targetParty.forEach(hero => {
                    if(!hero.dead) {
                        let heal = healAmount;
                        if(healPercent > 0) {
                            heal = Math.ceil(hero.maxHitpoints * (healPercent / 100));
                        }
                        if(heal > 0) {
                            hero.heal({ amount: heal }, null);
                        }
                    }
                });
                
                if(healPercent > 0) {
                    this.log.add(`Party healed for ${healPercent}% at ${trigger}`);
                } else if(healAmount > 0) {
                    this.log.add(`Party healed for ${healAmount} HP at ${trigger}`);
                }
                break;
            }
            
            case 'buff': {
                // Apply buff based on party property
                const auraId = effect.id;
                if(auraId && effect.party !== 'enemy') {
                    // Party buffs applied to living heroes
                    this.party.forEachLiving(hero => {
                        hero.auras.add(auraId, effect.stacks || 1, effect.sourceName);
                    });
                }
                // Enemy buffs handled by encounter system at spawn
                break;
            }
            
            case 'debuff': {
                // These are applied to enemies at spawn, handled by encounter system
                // No action needed here - stored in cache for encounter to retrieve
                break;
            }
            
            default:
                // Unknown effect type - can extend here for new types
                break;
        }
    }

    onLoad() {
        super.onLoad();

        this.buildings.forEach(building => building.onLoad());
        this.townActions.forEach(townAction => townAction.onLoad());
        this.products.forEach(product => product.onLoad());
        this.jobs.forEach(job => job.onLoad());
        this.auras.forEach(aura => aura.onLoad());
        this.areas.forEach(area => area.onLoad());
        this.baseItems.forEach(baseItem => baseItem.onLoad());
        this.monsters.forEach(monster => monster.onLoad());
        this.materials.forEach(material => material.onLoad());
        this.consumableTypes.forEach(consumable => consumable.onLoad());
        this.tavernDrinks.forEach(drink => drink.onLoad());

        this.pages.onLoad();

        this.overview.onLoad();
        this.party.onLoad();

        // Handle pending reset from failed decode - AFTER all components are loaded
        if(this._pendingReset) {
            this._pendingReset = false;
            try {
                this.resetSkill();
                this.log.add('Save data was corrupted. Skill has been reset.');
            } catch(e) {
                console.warn('Adventuring resetSkill failed after decode error:', e);
                // Continue loading even if reset fails - the skill may be in a partial state
                // but it's better than completely breaking the game
            }
        }

        this.town.checkActions();
        
        if(this.isActive) {
            this.dungeon.go();
        } else {
            this.town.go();
        }
    }

    onLevelUp(oldLevel, newLevel) {
        super.onLevelUp(oldLevel, newLevel);
        this.party.forEach(member => {
            member.calculateStats();
            member.renderQueue.jobs = true;
        });

        // Emit skill level up event
        this.emit('skill:level-up', { oldLevel, newLevel, level: newLevel });

        this.jobs.forEach(job => {
            job.renderQueue.name = true;
            job.renderQueue.tooltip = true;
            job.renderQueue.icon = true;
            job.renderQueue.clickable = true;
            job.renderQueue.mastery = true;
        });

        this.areas.forEach(area => {
            area.renderQueue.name = true;
            area.renderQueue.tooltip = true;
            area.renderQueue.icon = true;
            area.renderQueue.clickable = true;
            area.renderQueue.mastery = true;
        });

        this.baseItems.forEach(baseItem => {
            baseItem.renderQueue.tooltip = true;
            baseItem.renderQueue.upgrade = true;
            baseItem.renderQueue.icon = true;
        });

        this.monsters.forEach(monster => {
            monster.renderQueue.name = true;
            monster.renderQueue.tooltip = true;
            monster.renderQueue.icon = true;
            monster.renderQueue.clickable = true;
            monster.renderQueue.mastery = true;
        });
        
        // Check for newly unlocked equipment based on skill level requirements
        this.armory.checkUnlocked();
    }

    onMasteryLevelUp(action, oldLevel, newLevel) {
        super.onMasteryLevelUp(action, oldLevel, newLevel);
        
        // Invalidate the mastery effects cache for this action
        if (action.invalidateMasteryCache) {
            action.invalidateMasteryCache();
        }
        
        this.party.forEach(member => {
            member.calculateStats();
            member.renderQueue.jobs = true;
        });

        this.jobs.forEach(job => {
            job.renderQueue.name = true;
            job.renderQueue.tooltip = true;
            job.renderQueue.icon = true;
            job.renderQueue.clickable = true;
            job.renderQueue.mastery = true;
        });

        this.areas.forEach(area => {
            area.renderQueue.name = true;
            area.renderQueue.tooltip = true;
            area.renderQueue.icon = true;
            area.renderQueue.clickable = true;
            area.renderQueue.mastery = true;
        });

        this.baseItems.forEach(baseItem => {
            baseItem.renderQueue.tooltip = true;
            baseItem.renderQueue.upgrade = true;
            baseItem.renderQueue.icon = true;
        });

        this.monsters.forEach(monster => {
            monster.renderQueue.name = true;
            monster.renderQueue.tooltip = true;
            monster.renderQueue.icon = true;
            monster.renderQueue.clickable = true;
            monster.renderQueue.mastery = true;
        });
    }

    selectArea(area) {
        if(this.party.all.some(member => !member.dead)) {
            this.dungeon.setArea(area);
            this.dungeon.start();
            this.dungeon.go();
        }
    }

    selectBuilding(building) {
        if(building.page !== undefined) {
            this.town.setBuilding(building);
        }
    }

    get name() { return "Adventuring"; }
    get isCombat() { return true; }
    get hasMinibar() { return true; }
    get hasMastery() { return false; }

    get activeSkills() {
        if (!this.isActive)
            return [];
        else
            return [this];
    }

    get canStop() {
        return this.isActive && !this.game.isGolbinRaid;
    }

    get canStart() {
        return !this.game.idleChecker(this);
    }

    isMasteryActionUnlocked(action) {
        return action.unlocked;
    }

    getActionModifierQueryParams(action) {
        const scope = super.getActionModifierQueryParams(action);
        if (action && action.category !== undefined) {
            scope.category = action.category;
        }
        if (action && action.action !== undefined) {
            scope.action = action;
        }
        return scope;
    }

    /**
     * Get a modifier query with no action scope - for skill-wide modifiers
     * Uses cached modQuery created in Skill constructor
     */
    getModifierQuery() {
        return this.modQuery;
    }

    getRegistry(type) {
        switch (type) {
            case ScopeSourceType.Category:
                return this.categories;
            case ScopeSourceType.Action:
                return this.actions;
        }
    }

    /**
     * Get the next mastery level unlock for a specific category
     * @param {number} level - Current mastery level
     * @param {string} categoryId - SkillCategory ID (e.g., 'adventuring:Areas')
     * @returns {object|undefined} Next milestone for this category, or undefined if maxed
     */
    getNextMasteryUnlock(level, categoryId) {
        // Map SkillCategory IDs to MasteryCategory IDs (Areas -> areas, Jobs -> jobs, etc.)
        const masteryId = categoryId.replace(/([A-Z])/g, (match) => match.toLowerCase());
        const masteryCategory = this.masteryCategories.getObjectByID(masteryId);
        return masteryCategory ? masteryCategory.getNextMilestone(level) : undefined;
    }

    computeTotalMasteryActions() {
        this.actions.namespaceMaps.forEach((actionMap,namespace)=>{
            this.totalMasteryActions.set(namespace, actionMap.size);
        }
        );
        this.actions.forEach((action)=>{
            this.totalMasteryActionsInRealm.inc(action.realm);
        }
        );
    }
    
    getTotalUnlockedMasteryActions() {
        return this.actions.reduce(levelUnlockSum(this), 0);
    }

    start() {
        if (!this.canStart)
            return false;
        
        this.isActive = true;
        this.game.renderQueue.activeSkills = true;
        this.game.activeAction = this;

        if(!this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.start(this.dungeon.exploreInterval);
        
        if(this.townTimer.isActive)
            this.townTimer.stop();
        
        this.overview.renderQueue.turnProgressBar = true;

        // Notify tutorial system of state change
        this.tutorialManager.onStateChange();

        saveData();
        return true;
    }

    stop() {
        if(!this.canStop)
            return false;
        
        if(this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        
        if(this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
    
        if(this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();

        if(this.isActive && this.dungeon.area !== undefined)
            this.dungeon.abandon();

        this.isActive = false;
        this.game.renderQueue.activeSkills = true;
        this.game.clearActiveAction(false);

        if(!this.townTimer.isActive)
            this.townTimer.start(this.townInterval);
        
        this.town.resetActions();
        
        this.overview.renderQueue.turnProgressBar = true;

        // Notify tutorial system of state change
        this.tutorialManager.onStateChange();

        saveData();
        return true;
    }

    getErrorLog() {
        let log = `Is Active: ${this.isActive}\n`;
        const currentPage = this.pages.current;
        const pageName = currentPage !== undefined && currentPage.constructor !== undefined ? currentPage.constructor.name : 'none';
        log += `Current Page: ${pageName}\n`;
        log += this.party.getErrorLog();
        log += this.dungeon.getErrorLog();
        log += this.encounter.getErrorLog();
        return log;
    }

    activeTick() {
        if(this.encounter.isFighting) {
            this.encounter.currentTimer.tick();
        } else {
            if(!this.dungeon.exploreTimer.isActive)
                this.dungeon.exploreTimer.start(this.dungeon.exploreInterval);
            this.dungeon.exploreTimer.tick();
        }
    }

    passiveTick() {
        if(this.isActive)
            return;
        
        if(this.dungeon.exploreTimer.isActive)
            this.dungeon.exploreTimer.stop();
        
        if(this.encounter.turnTimer.isActive)
            this.encounter.turnTimer.stop();
    
        if(this.encounter.hitTimer.isActive)
            this.encounter.hitTimer.stop();
        
        this.party.forEach(member => {
            if(member.energy > 0)
                member.setEnergy(0);
        });

        if(!this.townTimer.isActive) {
            this.townTimer.start(this.townInterval);

            this.town.resetActions();
        
            this.overview.renderQueue.turnProgressBar = true;
        }
        
        if(this.townTimer.isActive)
            this.townTimer.tick();
    }

    getMasteryXP(action) {
        //if(!action.unlocked)
        //    return -Infinity;
        return super.getMasteryXP(action);
    }

    addMasteryXP(action, xp) {
        const oldLevel = this.getMasteryLevel(action);
        super.addMasteryXP(action, xp);
        const newLevel = this.getMasteryLevel(action);

        // Emit mastery level up event
        if(newLevel > oldLevel) {
            let category = 'other';
            const firstJob = this.jobs.registeredObjects.values().next().value;
            if(firstJob !== undefined && action instanceof firstJob.constructor) {
                category = 'job';
            } else if(this.areas.allObjects.includes(action)) {
                category = 'area';
            } else if(this.baseItems.allObjects.includes(action)) {
                category = 'equipment';
            }
            this.emit('mastery:level-up', { action, category, oldLevel, newLevel, level: newLevel });
        }
    }

    onPageChange() {
        this.overview.renderQueue.turnProgressBar = true;
        this.pages.onPageChange();
    }

    onShow() {
        // Called when the adventuring page becomes visible
        this.tutorialManager.onPageVisible();
    }

    onPageVisible() {
        // Called when the adventuring page becomes visible
        this.tutorialManager.onPageVisible();
    }

    nextTownTick() {
        if(this.isActive)
            return;
            
        this.town.performActions();

        this.townTimer.start(this.townInterval);
        this.overview.renderQueue.turnProgressBar = true;
    }

    render() {
        // Skip rendering if a reset is pending (save data was corrupt)
        if (this._pendingReset)
            return;
        super.render();
        this.overview.render();
        this.log.render();
        this.party.render();
        this.pages.render();
    }

    registerData(namespace, data) {
        super.registerData(namespace, data); // pets, rareDrops, minibar, customMilestones

        if(data.categories !== undefined) {
            data.categories.forEach(data => {
                this.categories.registerObject(new SkillCategory(namespace, data, this, this.game));
            });
        }

        if(data.materialCategories !== undefined) {
            data.materialCategories.forEach(data => {
                let category = new AdventuringMaterialCategory(namespace, data, this, this.game);
                this.materialCategories.registerObject(category);
            });
        }

        if(data.consumableCategories !== undefined) {
            data.consumableCategories.forEach(data => {
                let category = new AdventuringConsumableCategory(namespace, data, this, this.game);
                this.consumableCategories.registerObject(category);
            });
        }

        if(data.masteryCategories !== undefined) {
            data.masteryCategories.forEach(data => {
                let category = new AdventuringMasteryCategory(namespace, data, this, this.game);
                this.masteryCategories.registerObject(category);
            });
        }

        if(data.overview !== undefined)
            this.overview.registerData(data.overview);

        if(data.stats !== undefined) {
            data.stats.forEach(data => {
                let stat = new AdventuringStat(namespace, data, this, this.game);
                this.stats.registerObject(stat);
            });
        }

        if(data.buildings !== undefined) {
            data.buildings.forEach(data => {
                let building = new AdventuringBuilding(namespace, data, this, this.game);
                this.buildings.registerObject(building);
            });
        }

        if(data.townActions !== undefined) {
            data.townActions.forEach(data => {
                let townAction = new AdventuringTownAction(namespace, data, this, this.game);
                this.townActions.registerObject(townAction);
            });
        }

        if(data.products !== undefined) {
            data.products.forEach(data => {
                let product = new AdventuringProduct(namespace, data, this, this.game);
                this.products.registerObject(product);
            });
        }

        if(data.jobs !== undefined) {
            data.jobs.forEach(data => {
                let job = new AdventuringJob(namespace, data, this, this.game);
                this.jobs.registerObject(job);
                if(job.id !== "adventuring:none")
                    this.actions.registerObject(job);
            });
        }

        if(data.generators !== undefined) {
            data.generators.forEach(data => {
                let generator = new AdventuringGenerator(namespace, data, this, this.game);
                this.generators.registerObject(generator);
            });
        }

        if(data.spenders !== undefined) {
            data.spenders.forEach(data => {
                let spender = new AdventuringSpender(namespace, data, this, this.game);
                this.spenders.registerObject(spender);
            });
        }

        if(data.passives !== undefined) {
            data.passives.forEach(data => {
                let passive = new AdventuringPassive(namespace, data, this, this.game);
                this.passives.registerObject(passive);
            });
        }

        if(data.buffs !== undefined) {
            data.buffs.forEach(data => {
                let buff = new AdventuringBuff(namespace, data, this, this.game);
                this.buffs.registerObject(buff);
                this.auras.registerObject(buff);
            });
        }

        if(data.debuffs !== undefined) {
            data.debuffs.forEach(data => {
                let debuff = new AdventuringDebuff(namespace, data, this, this.game);
                this.debuffs.registerObject(debuff);
                this.auras.registerObject(debuff);
            });
        }

        if(data.difficulties !== undefined) {
            data.difficulties.forEach(data => {
                let difficulty = new AdventuringDifficulty(namespace, data, this, this.game);
                this.difficulties.registerObject(difficulty);
            });
        }

        if(data.areas !== undefined) {
            data.areas.forEach(data => {
                let area = new AdventuringArea(namespace, data, this, this.game);
                this.areas.registerObject(area);
                this.actions.registerObject(area);
                
                // Register dungeon mastery aura if defined
                if(data.masteryAura) {
                    let aura = new AdventuringBuff(namespace, data.masteryAura, this, this.game);
                    this.dungeonAuras.registerObject(aura);
                    this.auras.registerObject(aura);
                }
            });
        }
        
        if(data.monsters !== undefined) {
            data.monsters.forEach(data => {
                let monster = new AdventuringMonster(namespace, data, this, this.game);
                this.monsters.registerObject(monster);
                this.actions.registerObject(monster);
            });
        }
        
        if(data.tiles !== undefined) {
            data.tiles.forEach(data => {
                let tile = new AdventuringDungeonTile(namespace, data, this, this.game);
                this.tiles.registerObject(tile);
            });
        }

        if(data.slayerTaskTypes !== undefined) {
            data.slayerTaskTypes.forEach(data => {
                let taskType = new AdventuringSlayerTaskType(namespace, data, this, this.game);
                this.slayerTaskTypes.registerObject(taskType);
            });
        }

        if(data.rewardTypes !== undefined) {
            data.rewardTypes.forEach(data => {
                let rewardType = new AdventuringRewardType(namespace, data, this, this.game);
                this.rewardTypes.registerObject(rewardType);
            });
        }

        if(data.itemSlots !== undefined) {
            data.itemSlots.forEach(data => {
                let slot = new AdventuringItemSlot(namespace, data, this, this.game);
                this.itemSlots.registerObject(slot);
            });
        }

        if(data.itemTypes !== undefined) {
            data.itemTypes.forEach(data => {
                let itemType = new AdventuringItemType(namespace, data, this, this.game);
                this.itemTypes.registerObject(itemType);
            });
        }

        if(data.materials !== undefined) {
            data.materials.forEach(data => {
                let material = new AdventuringMaterial(namespace, data, this, this.game);
                this.materials.registerObject(material);
            });
        }

        if(data.baseItems !== undefined) {
            data.baseItems.forEach(data => {
                let item = new AdventuringItemBase(namespace, data, this, this.game);
                this.baseItems.registerObject(item);
                if(item.id !== "adventuring:none")
                    this.actions.registerObject(item);
            });
        }

        if(data.consumables !== undefined) {
            data.consumables.forEach(data => {
                let consumable = new AdventuringConsumable(namespace, data, this, this.game);
                this.consumableTypes.registerObject(consumable);
            });
        }

        // Also support consumableTypes key (used in job files)
        if(data.consumableTypes !== undefined) {
            data.consumableTypes.forEach(data => {
                let consumable = new AdventuringConsumable(namespace, data, this, this.game);
                this.consumableTypes.registerObject(consumable);
            });
        }

        if(data.tavernDrinks !== undefined) {
            data.tavernDrinks.forEach(data => {
                let drink = new AdventuringTavernDrink(namespace, data, this, this.game);
                this.tavernDrinks.registerObject(drink);
            });
        }

        if(data.equipmentSets !== undefined) {
            data.equipmentSets.forEach(data => {
                let set = new AdventuringEquipmentSet(namespace, data, this, this.game);
                this.equipmentSets.registerObject(set);
            });
        }

        if(data.equipmentPools !== undefined) {
            data.equipmentPools.forEach(data => {
                let pool = new AdventuringEquipmentPool(namespace, data, this, this.game);
                this.equipmentPools.registerObject(pool);
            });
        }

        if(data.lootTables !== undefined) {
            data.lootTables.forEach(data => {
                let table = new AdventuringLootTable(namespace, data, this, this.game);
                this.lootTables.registerObject(table);
            });
        }

        if(data.tutorials !== undefined) {
            data.tutorials.forEach(data => {
                let tutorial = new AdventuringTutorial(namespace, data, this);
                this.tutorials.registerObject(tutorial);
            });
        }

        if(data.achievementCategories !== undefined) {
            data.achievementCategories.forEach(data => {
                let category = new AdventuringAchievementCategory(namespace, data, this, this.game);
                this.achievementCategories.registerObject(category);
            });
        }

        if(data.achievements !== undefined) {
            data.achievements.forEach(data => {
                let achievement = new AdventuringAchievement(namespace, data, this, this.game);
                this.achievements.registerObject(achievement);
            });
        }
    }

    postDataRegistration() {
        super.postDataRegistration(); // Milestones setLevel

        this.buildings.forEach(building => building.postDataRegistration());
        this.townActions.forEach(townAction => townAction.postDataRegistration());
        this.products.forEach(product => product.postDataRegistration());
        this.jobs.forEach(job => job.postDataRegistration());
        this.difficulties.forEach(difficulty => difficulty.postDataRegistration());
        this.areas.forEach(area => area.postDataRegistration());
        this.generators.forEach(generator => generator.postDataRegistration());
        this.spenders.forEach(spender => spender.postDataRegistration());
        this.passives.forEach(passive => passive.postDataRegistration());
        
        // Build passives-by-job cache for O(1) lookup
        this.passivesByJob = new Map();
        this.jobs.forEach(job => {
            const jobPassives = this.passives.allObjects.filter(p => p.unlockedBy(job));
            this.passivesByJob.set(job.id, jobPassives);
        });
        
        // Cache frequently accessed objects to avoid repeated lookups
        this.cached = {
            noneJob: this.jobs.getObjectByID('adventuring:none'),
            slayerJob: this.jobs.getObjectByID('adventuring:slayer'),
            noneItem: this.baseItems.getObjectByID('adventuring:none'),
            noneItemSlot: this.itemSlots.getObjectByID('adventuring:none'),
            slayerCoins: this.materials.getObjectByID('adventuring:slayer_coins'),
            currency: this.materials.getObjectByID('adventuring:currency'),
            defaultGenerator: this.generators.getObjectByID('adventuring:basic_attack'),
            defaultSpender: this.spenders.getObjectByID('adventuring:basic_strike')
        };
        
        // Cache job lists for filtering
        this.combatJobs = this.jobs.allObjects.filter(job => job.id !== 'adventuring:none' && !job.isPassive);
        this.passiveJobs = this.jobs.allObjects.filter(job => job.id !== 'adventuring:none' && job.isPassive);
        
        this.auras.forEach(aura => aura.postDataRegistration());
        this.materials.forEach(material => material.postDataRegistration());
        this.baseItems.forEach(baseItem => baseItem.postDataRegistration());
        this.consumableTypes.forEach(consumable => consumable.postDataRegistration());
        this.tavernDrinks.forEach(drink => drink.postDataRegistration());
        this.equipmentSets.forEach(set => set.postDataRegistration());
        this.equipmentPools.forEach(pool => pool.postDataRegistration());

        // Build source lookup tables for tooltips
        this.buildSourceLookups();

        let jobMilestones = this.jobs.allObjects.filter(job => job.isMilestoneReward);
        let areaMilestones = this.areas.allObjects.filter(area => area.isMilestoneReward);

        let milestones = [...jobMilestones, ...areaMilestones].map(milestone => {
            if(milestone.requirements.length === 1 && milestone.requirements[0].type === "skill_level")
                return {
                    get name() { return milestone.name },
                    get media() { return milestone.media },
                    get level() { return milestone.requirements[0].level }
                };
            return undefined;
        }).filter(milestone => milestone !== undefined);

        this.milestones.push(...milestones);
        this.sortMilestones();
        
        this.sortedMasteryActions = [];

        this.overview.postDataRegistration();

        this.party.postDataRegistration();

        this.pages.postDataRegistration();

        this.tutorialManager.postDataRegistration();

        // Initialize achievement system
        this.achievementManager.init();

        let capesToExclude = ["melvorF:Max_Skillcape", "melvorTotH:Superior_Max_Skillcape"];
        let skillCapes = this.game.shop.purchases.filter(purchase => capesToExclude.includes(purchase.id));
        skillCapes.forEach(cape => {
            let allSkillLevelsRequirement = cape.purchaseRequirements.find(req => req.type === "AllSkillLevels");
            if(allSkillLevelsRequirement !== undefined) {
                if(allSkillLevelsRequirement.exceptions === undefined)
                    allSkillLevelsRequirement.exceptions = new Set();
                allSkillLevelsRequirement.exceptions.add(this);
            }
        });
    }

    /**
     * Build reverse lookup tables for source hints in tooltips
     * Maps materials -> monsters that drop them, monsters -> areas they appear in
     */
    buildSourceLookups() {
        // Monster -> Areas lookup
        this.monsterSources = new Map();
        this.areas.forEach(area => {
            if(!area.floors) return;
            area.floors.forEach(floor => {
                // Check floor monsters (random encounter pool)
                if(floor.monsters) {
                    floor.monsters.forEach(entry => {
                        const monster = this.monsters.getObjectByID(entry.id);
                        if(!monster) return;
                        if(!this.monsterSources.has(monster)) {
                            this.monsterSources.set(monster, []);
                        }
                        const sources = this.monsterSources.get(monster);
                        if(!sources.includes(area)) {
                            sources.push(area);
                        }
                    });
                }
                // Check exit encounters (includes bosses)
                if(floor.exit) {
                    floor.exit.forEach(monsterId => {
                        const monster = this.monsters.getObjectByID(monsterId);
                        if(!monster) return;
                        if(!this.monsterSources.has(monster)) {
                            this.monsterSources.set(monster, []);
                        }
                        const sources = this.monsterSources.get(monster);
                        if(!sources.includes(area)) {
                            sources.push(area);
                        }
                    });
                }
            });
        });

        // Material -> Monsters lookup
        this.materialSources = new Map();
        this.monsters.forEach(monster => {
            if(monster.lootGenerator === undefined || monster.lootGenerator.table === undefined) return;
            monster.lootGenerator.table.forEach(entry => {
                const material = this.materials.getObjectByID(entry.id);
                if(!material) return;
                if(!this.materialSources.has(material)) {
                    this.materialSources.set(material, []);
                }
                const sources = this.materialSources.get(material);
                if(!sources.includes(monster)) {
                    sources.push(monster);
                }
            });
        });
    }

    /**
     * Get passives that are unlocked by a specific job (uses cached lookup)
     * @param {AdventuringJob} job - The job to get passives for
     * @returns {AdventuringPassive[]} Array of passives unlocked by this job
     */
    getPassivesForJob(job) {
        if (this.passivesByJob === undefined) return [];
        const passives = this.passivesByJob.get(job.id);
        return passives !== undefined ? passives : [];
    }

    /**
     * Get an ability by ID from either generators or spenders registry
     * @param {string} id - The ability ID
     * @returns {AdventuringAbility|undefined}
     */
    getAbilityByID(id) {
        const gen = this.generators.getObjectByID(id);
        if (gen !== undefined) return gen;
        return this.spenders.getObjectByID(id);
    }

    encode(writer) {
        let start = writer.byteOffset;
        super.encode(writer); // Encode default skill data
        writer.writeUint32(this.version); // Store current skill version

        this.party.encode(writer);
        this.pages.encode(writer);
        writer.writeBoolean(this.isActive);

        // Encode learned abilities (Blue Mage)
        writer.writeUint32(this.learnedAbilities.size);
        this.learnedAbilities.forEach(abilityId => {
            const ability = this.getAbilityByID(abilityId);
            writer.writeNamespacedObject(ability);
        });

        // Encode slayer tasks (version 6+)
        this.slayers.encode(writer);

        // Encode tavern drinks (version 7+)
        this.tavern.encode(writer);

        // Encode lemon stats (version 7+)
        this.lemons.encode(writer);

        // Encode consumables (version 9+)
        this.consumables.encode(writer);

        // Encode seen abilities (version 11+)
        // Filter out any undefined abilities before writing
        const validSeenAbilities = [...this.seenAbilities]
            .map(id => this.getAbilityByID(id))
            .filter(ability => ability !== undefined);
        writer.writeUint32(validSeenAbilities.length);
        validSeenAbilities.forEach(ability => {
            writer.writeNamespacedObject(ability);
        });

        // Encode tutorial state (version 12+)
        this.tutorialManager.encode(writer);

        // Encode achievement state (version 13+)
        this.achievementManager.encode(writer);

        // Encode grimoire state (version 5+)
        this.grimoire.encode(writer);

        return writer;
    }

    decode(reader, version) {
        let start = reader.byteOffset;
        reader.byteOffset -= Uint32Array.BYTES_PER_ELEMENT; // Let's back up a minute and get the size of our skill data
        let skillDataSize = reader.getUint32();

        try {
            super.decode(reader, version);
            this.saveVersion = reader.getUint32(); // Read save version
            if(this.saveVersion < this.version)
                throw new Error("Old Save Version");

            this.party.decode(reader, version);
            this.pages.decode(reader, version);
            this.isActive = reader.getBoolean();

            // Decode learned abilities (Blue Mage)
            const numLearned = reader.getUint32();
            for(let i = 0; i < numLearned; i++) {
                // Try generators first, then spenders
                let ability = reader.getNamespacedObject(this.generators);
                if(typeof ability === 'string') {
                    // Not found in generators, try spenders
                    ability = this.spenders.getObjectByID(ability);
                }
                if(ability !== undefined && typeof ability !== 'string') {
                    this.learnedAbilities.add(ability.id);
                }
            }

            // Decode slayer tasks
            this.slayers.decode(reader, version);

            // Decode tavern and lemons
            this.tavern.decode(reader, version);
            this.lemons.decode(reader, version);

            // Decode consumables (includes tavern drinks as charges)
            this.consumables.decode(reader, version);

            // Decode seen abilities
            const numSeen = reader.getUint32();
            for(let i = 0; i < numSeen; i++) {
                // Try generators first, then spenders
                let ability = reader.getNamespacedObject(this.generators);
                if(typeof ability === 'string') {
                    // Not found in generators, try spenders
                    ability = this.spenders.getObjectByID(ability);
                }
                if(ability !== undefined && typeof ability !== 'string') {
                    this.seenAbilities.add(ability.id);
                }
            }

            // Decode tutorial state (version 12+)
            this.tutorialManager.decode(reader, version);

            // Decode achievement state (version 13+)
            this.achievementManager.decode(reader, version);

            // Decode grimoire state (version 5+)
            if(this.saveVersion >= 5) {
                this.grimoire.decode(reader, version);
            }
        } catch(e) { 
            // Save data is corrupt or incompatible - do a full reset instead of partial load
            console.warn('Adventuring save decode failed, performing full reset:', e);
            reader.byteOffset = start;
            reader.getFixedLengthBuffer(skillDataSize);
            
            // Schedule reset after load completes (can't reset during decode)
            this._pendingReset = true;
        }
    }

    checkpoints = [
        { description: "+5% Adventuring Mastery XP" },
        { description: "+50% Consumable Preservation Chance" },
        { description: "+10% Material Drop Rate" },
        { description: "+10 Starting Energy" }
    ]

    openMasteryPoolBonusModal() {
        const html = masteryCheckpoints.map((percentRequired,i)=>{
            const isActive = this.isPoolTierActive(i);
            const checkpointXP = Math.floor((this.baseMasteryPoolCap * percentRequired) / 100);
            let checkPointStatus = '';
            if (isActive) {
                checkPointStatus = templateLangString('MENU_TEXT_CHECKPOINT_ACTIVE', {
                    xp: numberWithCommas(checkpointXP),
                });
            } else {
                checkPointStatus = templateLangString('MENU_TEXT_XP_REMAINING', {
                    xpLeft: numberWithCommas(Math.ceil(checkpointXP - this.masteryPoolXP)),
                    xp: numberWithCommas(checkpointXP),
                });
            }
            const bonusDescription = this.checkpoints[i].description;
            return `<div class="col-12">
      <div class="block block-rounded-double bg-combat-inner-dark p-3">
        <div class="media d-flex align-items-center push">
          <div class="mr-3">
            <h2 class="font-w700 ${isActive ? 'text-success' : 'text-danger'} mb-0" id="mastery-modal-checkpoint-percent-0">
              ${formatPercent(percentRequired)}
            </h2>
          </div>
          <div class="media-body">
            <div class="font-w600 font-size-sm" id="mastery-modal-checkpoint-description-0">
              ${bonusDescription}
            </div>
            <div class="font-size-sm" id="mastery-modal-checkpoint-xp-required-0">
              <small>${checkPointStatus}</small>
            </div>
          </div>
        </div>
      </div>
    </div>`;
        }
        ).join('');
        $('#modal-content-checkpoints').html(html);
        $('#modal-mastery-checkpoints').modal('show');
    }
}

