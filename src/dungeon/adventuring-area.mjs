const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringAreaElement } = await loadModule('src/dungeon/components/adventuring-area.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

const { AdventuringWeightedTable, addMasteryXPWithBonus, RequirementsChecker, AdventuringMasteryRenderQueue } = await loadModule('src/core/adventuring-utils.mjs');

/**
 * Area-specific RenderQueue with autoRepeat support
 */
class AdventuringAreaRenderQueue extends AdventuringMasteryRenderQueue {
    constructor(){
        super();
        this.autoRepeat = false;
    }

    queueAll() {
        super.queueAll();
        this.autoRepeat = true;
    }
}

export class AdventuringArea extends AdventuringMasteryAction {
    constructor(namespace, data, manager, game) {
        super(namespace, data, manager, game);

        this.component = createElement('adventuring-area');
        this.renderQueue = new AdventuringAreaRenderQueue();

        this._name = data.name;

        this._media = data.media;

        this.requirements = data.requirements || [];

        this.floors = data.floors;

        this.height = data.height;
        this.width = data.width;

        this.tiles = data.tiles;

        this.loot = data.loot;
        
        this.lootPoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
        //this.lootPoolGenerator.loadTable(this.loot.pool);
        
        /*if(this.tiles.treasure.loot) {
            this.treasurePoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
            this.treasurePoolGenerator.loadTable(this.tiles.treasure.loot.pool);
        }*/

        // Adventure button click handler
        this.component.adventureButton.onclick = () => {
            if(this.unlocked)
                this.manager.selectArea(this);
        };

        // Auto-repeat checkbox handler
        this.component.autoRepeat.onchange = () => {
            if(this.component.autoRepeat.checked) {
                this.manager.setAutoRepeatArea(this);
            } else {
                this.manager.setAutoRepeatArea(null);
            }
        };

        // Difficulty selection - stores the difficulty object directly
        this.selectedDifficulty = null; // Set in postDataRegistration
        this.difficultyOptionElements = [];

        // Endless mode streak tracking
        this.bestEndlessStreak = 0;

        // Gauntlet mode properties
        this.isGauntlet = data.isGauntlet ?? false;
        this.gauntletTier = data.gauntletTier ?? 0;
        this.gauntletRewardMultiplier = data.gauntletRewardMultiplier ?? 1.0;
        
        // Area description (for UI display)
        this.description = data.description ?? '';
        
        // Area-specific passive effects
        this._passives = data.passives ?? [];

        // Mastery aura id (looked up during postDataRegistration)
        this._masteryAuraId = data.masteryAuraId;
        this.masteryAura = null;
    }

    get masteryCategoryId() {
        return 'adventuring:areas';
    }

    /**
     * Get all registered difficulties
     */
    getAllDifficulties() {
        return this.manager.difficulties.allObjects;
    }

    /**
     * Initialize difficulty dropdown options
     */
    initDifficultyDropdown() {
        this.component.difficultyOptions.replaceChildren();
        this.difficultyOptionElements = [];
        
        this.getAllDifficulties().forEach((difficulty) => {
            const option = createElement('a', {
                className: 'dropdown-item pointer-enabled',
                text: difficulty.name
            });
            option.onclick = () => this.setDifficulty(difficulty);
            this.component.difficultyOptions.appendChild(option);
            this.difficultyOptionElements.push(option);
        });
        
        // Set default difficulty to first one (Normal)
        if(!this.selectedDifficulty && this.getAllDifficulties().length > 0) {
            this.selectedDifficulty = this.getAllDifficulties()[0];
        }
    }

    /**
     * Set the selected difficulty
     */
    setDifficulty(difficulty) {
        if(!difficulty) return;
        
        // Check if this difficulty is unlocked
        if(!difficulty.isUnlocked(this)) {
            this.manager.log.add(`${difficulty.name} mode requires Mastery Level ${difficulty.unlockLevel}!`);
            return;
        }
        
        this.selectedDifficulty = difficulty;
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
    }

    /**
     * Cycle to next available difficulty mode (for keyboard shortcut if needed)
     */
    cycleDifficulty() {
        const availableDifficulties = this.getAvailableDifficulties();
        if(availableDifficulties.length <= 1) return;

        const currentIndex = availableDifficulties.indexOf(this.selectedDifficulty);
        const nextIndex = (currentIndex + 1) % availableDifficulties.length;
        this.selectedDifficulty = availableDifficulties[nextIndex];
        
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
    }

    /**
     * Get difficulties unlocked for this area based on mastery effects
     */
    getAvailableDifficulties() {
        return this.getAllDifficulties().filter(d => d.isUnlocked(this));
    }

    /**
     * Get the currently selected difficulty mode
     */
    getDifficulty() {
        return this.selectedDifficulty || this.getAllDifficulties()[0];
    }

    get name() {
        return this._name;
    }

    get media() {
        return this.unlocked ? this.getMediaURL(this._media) : this.getMediaURL('melvor:assets/media/main/question.png');
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

    /**
     * Get the skill level required to unlock this area
     */
    getUnlockLevel() {
        for (const requirement of this.requirements) {
            if (requirement.type === "skill_level") {
                return requirement.level;
            }
        }
        return 1; // Default to level 1 if no skill requirement
    }

    get unlocked() {
        if (this._reqChecker === undefined) return true;
        return this._reqChecker.check();
    }

    /**
     * Get all unique monsters that can appear in this area.
     * Collects monsters from all floors and deduplicates.
     * @returns {AdventuringMonster[]}
     */
    get monsters() {
        if (!this.floors) return [];
        
        const seen = new Set();
        const monsters = [];
        
        for (const floor of this.floors) {
            if (!floor.monsters) continue;
            for (const entry of floor.monsters) {
                if (seen.has(entry.id)) continue;
                seen.add(entry.id);
                
                const monster = this.manager.monsters.getObjectByID(entry.id);
                if (monster) monsters.push(monster);
            }
        }
        
        return monsters;
    }

    get category() {
        return this.manager.categories.getObjectByID('adventuring:Areas');
    }

    /**
     * Check if auto-repeat is unlocked for this dungeon
     */
    get autoRepeatUnlocked() {
        return this.hasMasteryEffect('unlock_auto_run');
    }

    /**
     * Check if endless difficulty is unlocked for this dungeon
     */
    get endlessModeUnlocked() {
        const endlessDifficulty = this.manager.difficulties.getObjectByID('adventuring:endless');
        return endlessDifficulty ? endlessDifficulty.isUnlocked(this) : false;
    }

    /**
     * Check if mastery aura is unlocked for this dungeon
     */
    get masteryAuraUnlocked() {
        return this.hasMasteryEffect('unlock_mastery_aura');
    }

    /**
     * Update best endless streak if new record
     */
    updateBestEndlessStreak(waves) {
        if(waves > this.bestEndlessStreak) {
            this.bestEndlessStreak = waves;
            this.manager.log.add(`New endless record: ${waves} waves!`);
            this.renderQueue.tooltip = true;
        }
    }

    /**
     * Get current dungeon mastery bonuses from modifier system
     */
    getMasteryBonuses() {
        // Query modifiers from the centralized modifier system
        const xpBonus = this.manager.modifiers.getDungeonXPBonus(this);
        const exploreSpeedBonus = this.manager.modifiers.getExploreSpeedBonus(this);
        
        return { xpBonus, exploreSpeedBonus };
    }

    /**
     * Get tooltip-ready effects for current mastery bonuses
     * Converts decimal bonuses to percentage values that describeEffect can format
     * @returns {Array} Array of {type, value} effect objects
     */
    getMasteryBonusEffects() {
        const { xpBonus, exploreSpeedBonus } = this.getMasteryBonuses();
        const effects = [];
        
        if(xpBonus > 0) {
            effects.push({ type: 'xp_percent', value: Math.round(xpBonus * 100) });
        }
        if(exploreSpeedBonus > 0) {
            effects.push({ type: 'explore_speed_percent', value: Math.round(exploreSpeedBonus * 100) });
        }
        
        return effects;
    }

    /**
     * Get tile weight modifiers based on mastery level from modifier system
     * Returns a map of tile ID to weight multiplier
     */
    getTileModifiers() {
        // Query tile spawn rate modifiers
        const trapMod = this.manager.modifiers.getTrapSpawnRateMod();
        const fountainMod = this.manager.modifiers.getFountainSpawnRateMod();
        const treasureMod = this.manager.modifiers.getTreasureSpawnRateMod();
        const shrineMod = this.manager.modifiers.getShrineSpawnRateMod();
        
        const modifiers = {};
        
        // Convert percentage modifiers to weight multipliers
        // -100% = 0 weight, -50% = 0.5 weight, +50% = 1.5 weight, +100% = 2.0 weight
        if(trapMod !== 0) modifiers['adventuring:trap'] = Math.max(0, 1 + trapMod / 100);
        if(fountainMod !== 0) modifiers['adventuring:fountain'] = 1 + fountainMod / 100;
        if(treasureMod > 0) modifiers['adventuring:treasure'] = treasureMod / 100;  // Treasure only spawns when unlocked
        if(shrineMod > 0) modifiers['adventuring:shrine'] = shrineMod / 100;  // Shrine only spawns when unlocked
        
        return modifiers;
    }

    /**
     * Get milestones achieved based on mastery category
     */
    getAchievedMilestones() {
        const category = this.masteryCategory;
        return category ? category.getAchievedMilestones(this.level) : [];
    }

    /**
     * Get next milestone to achieve for this area's mastery category
     */
    getNextMilestone() {
        const category = this.masteryCategory;
        return category ? category.getNextMilestone(this.level) : null;
    }

    get tooltip() {
        return TooltipBuilder.forArea(this, this.manager).build();
    }

    onLoad() {
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
        this.renderQueue.icon = true;
        this.renderQueue.clickable = true;
        this.renderQueue.mastery = true;
    }

    postDataRegistration() {
        this._reqChecker = new RequirementsChecker(this.manager, this.requirements);
        this.initDifficultyDropdown();
        
        // Look up mastery aura by id if defined
        if(this._masteryAuraId) {
            this.masteryAura = this.manager.dungeonAuras.getObjectByID(this._masteryAuraId);
        }
    }

    addXP(xp) {
        addMasteryXPWithBonus(this.manager, this, xp);
    }

    render() {
        this.renderName();
        this.renderTooltip();
        this.renderIcon();
        this.renderClickable();
        this.renderMastery();
        this.renderAutoRepeat();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            const difficulty = this.getDifficulty();
            this.component.nameText.textContent = this.name;
            this.component.level.textContent = ` (${this.level})`;
            this.component.level.className = difficulty.color;
            
            // Update dropdown button
            this.component.difficultyButton.textContent = difficulty.name;
            this.component.difficultyButton.className = `btn btn-sm dropdown-toggle ${difficulty.color.replace('text-', 'btn-')}`;
            
            // Update dropdown options (enable/disable based on level)
            this.getAllDifficulties().forEach((mode, index) => {
                const option = this.difficultyOptionElements[index];
                if(option) {
                    const isUnlocked = mode.isUnlocked(this);
                    const isSelected = mode === this.selectedDifficulty;
                    option.className = `dropdown-item pointer-enabled ${mode.color}`;
                    if(!isUnlocked) {
                        option.className += ' disabled text-muted';
                        option.textContent = `${mode.name} (Lv${mode.unlockLevel})`;
                    } else {
                        option.textContent = mode.name + (isSelected ? ' (Active)' : '');
                    }
                }
            });
        } else {
            this.component.nameText.textContent = "???";
            this.component.level.textContent = "";
        }

        this.renderQueue.name = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.unlocked) {
            this.component.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.png');
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        // Show/hide controls based on unlock status
        this.component.controls.classList.toggle('d-none', !this.unlocked);
        this.component.adventureButton.disabled = !this.unlocked;

        // Show/hide auto-repeat checkbox based on unlock status
        this.component.autoRepeatContainer.classList.toggle('d-none', !this.autoRepeatUnlocked);

        this.renderQueue.clickable = false;
    }

    renderAutoRepeat() {
        if(!this.renderQueue.autoRepeat)
            return;

        // Update checkbox state based on whether this area is the auto-repeat target
        const isAutoRepeatArea = this.manager.autoRepeatArea === this;
        this.component.autoRepeat.checked = isAutoRepeatArea;

        this.renderQueue.autoRepeat = false;
    }

    renderMastery() {
        if(!this.renderQueue.mastery)
            return;

        let { xp, level, percent } = this.manager.getMasteryProgress(this);

        if(this.unlocked) {
            this.component.masteryProgress.setFixedPosition(percent);
        } else {
            this.component.masteryProgress.setFixedPosition(0);
        }

        this.renderQueue.mastery = false;
    }
}