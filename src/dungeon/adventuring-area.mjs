const { loadModule } = mod.getContext(import.meta);

const { AdventuringMasteryAction } = await loadModule('src/core/adventuring-mastery-action.mjs');
const { AdventuringAreaElement } = await loadModule('src/dungeon/components/adventuring-area.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

const { AdventuringWeightedTable, addMasteryXPWithBonus, RequirementsChecker, AdventuringMasteryRenderQueue, getLockedMedia, UNKNOWN_MEDIA } = await loadModule('src/core/adventuring-utils.mjs');

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


        this.masteryXP = data.masteryXP || 2000;

        this.lootPoolGenerator = new AdventuringWeightedTable(this.manager, this.game);


        this.component.adventureButton.onclick = (e) => {
            e.stopPropagation();
            if(this.unlocked)
                this.manager.selectArea(this);
        };

        // Prevent card click when clicking on controls area, but allow dropdown to work
        this.component.controls.onclick = (e) => {
            // Don't stop propagation for dropdown button/menu - Bootstrap needs it
            const isDropdown = e.target.closest('.dropdown');
            if (!isDropdown) {
                e.stopPropagation();
            }
        };

        this.component.card.onclick = (e) => {
            // Don't open details if clicking in controls area (buttons, dropdown, etc)
            if (e.target.closest('#controls')) return;
            this.openDetails();
        };

        this.component.autoRepeat.onchange = () => {
            if(this.component.autoRepeat.checked) {
                this.manager.setAutoRepeatArea(this);
            } else {
                this.manager.setAutoRepeatArea(null);
            }
        };

        this.selectedDifficulty = null; // Set in postDataRegistration
        this.difficultyOptionElements = [];

        this.bestEndlessStreak = 0;

        this.isGauntlet = (data.isGauntlet !== undefined) ? data.isGauntlet : false;
        this.gauntletTier = (data.gauntletTier !== undefined) ? data.gauntletTier : 0;
        this.gauntletRewardMultiplier = (data.gauntletRewardMultiplier !== undefined) ? data.gauntletRewardMultiplier : 1.0;

        this.encounterFloorMax = data.encounterFloorMax; // undefined = use tile default
        this.encounterWeight = data.encounterWeight; // undefined = use tile default

        this.description = (data.description !== undefined) ? data.description : '';

        this._passives = data.passives || [];

        this._masteryAuraId = data.masteryAuraId;
        this.masteryAura = null;
    }

    get masteryCategoryId() {
        return 'adventuring:areas';
    }

    getAllDifficulties() {
        return this.manager.difficulties.allObjects;
    }

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

        if(!this.selectedDifficulty && this.getAllDifficulties().length > 0) {
            this.selectedDifficulty = this.getAllDifficulties()[0];
        }
    }

    setDifficulty(difficulty) {
        if(!difficulty) return;

        if(!difficulty.isUnlocked(this)) {
            this.manager.log.add(`${difficulty.name} mode requires Mastery Level ${difficulty.unlockLevel}!`, {
                category: 'dungeon_events'
            });
            return;
        }

        this.selectedDifficulty = difficulty;
        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
    }

    cycleDifficulty() {
        const availableDifficulties = this.getAvailableDifficulties();
        if(availableDifficulties.length <= 1) return;

        const currentIndex = availableDifficulties.indexOf(this.selectedDifficulty);
        const nextIndex = (currentIndex + 1) % availableDifficulties.length;
        this.selectedDifficulty = availableDifficulties[nextIndex];

        this.renderQueue.name = true;
        this.renderQueue.tooltip = true;
    }

    getAvailableDifficulties() {
        return this.getAllDifficulties().filter(d => d.isUnlocked(this));
    }

    getDifficulty() {
        return this.selectedDifficulty || this.getAllDifficulties()[0];
    }

    get name() {
        return this._name;
    }

    get media() {
        return getLockedMedia(this);
    }

    get level() {
        return this.manager.getMasteryLevel(this);
    }

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

    get autoRunUnlocked() {
        return this.hasUnlock('auto_run');
    }

    get endlessModeUnlocked() {
        const endlessDifficulty = this.manager.difficulties.getObjectByID('adventuring:endless');
        return endlessDifficulty ? endlessDifficulty.isUnlocked(this) : false;
    }

    get masteryAuraUnlocked() {
        return this.hasUnlock('mastery_aura');
    }

    updateBestEndlessStreak(waves) {
        if(waves > this.bestEndlessStreak) {
            this.bestEndlessStreak = waves;
            this.manager.log.add(`New endless record: ${waves} waves!`, {
                category: 'achievements'
            });
            this.renderQueue.tooltip = true;
        }
    }

    getMasteryBonuses() {

        const xpBonus = this.manager.party.getDungeonXPBonus(this);
        const exploreSpeedBonus = this.manager.party.getExploreSpeedBonus(this);

        return { xpBonus, exploreSpeedBonus };
    }

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

    getTileModifiers() {

        const trapMod = this.manager.party.getTrapSpawnRateMod();
        const fountainMod = this.manager.party.getFountainSpawnRateMod();
        const treasureMod = this.manager.party.getTreasureSpawnRateMod();
        const shrineMod = this.manager.party.getShrineSpawnRateMod();

        const modifiers = {};


        if(trapMod !== 0) modifiers['adventuring:trap'] = Math.max(0, 1 + trapMod / 100);
        if(fountainMod !== 0) modifiers['adventuring:fountain'] = 1 + fountainMod / 100;
        if(treasureMod > 0) modifiers['adventuring:treasure'] = treasureMod / 100;  // Treasure only spawns when unlocked
        if(shrineMod > 0) modifiers['adventuring:shrine'] = shrineMod / 100;  // Shrine only spawns when unlocked

        return modifiers;
    }

    getAchievedMilestones() {
        const category = this.masteryCategory;
        return category ? category.getAchievedMilestones(this.level) : [];
    }

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

        if(this._masteryAuraId) {
            this.masteryAura = this.manager.dungeonAuras.getObjectByID(this._masteryAuraId);
        }
    }

    addXP(xp) {
        addMasteryXPWithBonus(this.manager, this, xp);
    }

    openDetails() {
        if(!this.unlocked) return;
        this.manager.areadetails.setArea(this);
        this.manager.areadetails.render();
        this.manager.areadetails.go();
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

            this.component.difficultyButton.textContent = difficulty.name;
            this.component.difficultyButton.className = `btn btn-sm dropdown-toggle ${difficulty.color.replace('text-', 'btn-')}`;

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
            this.component.icon.src = this.getMediaURL(UNKNOWN_MEDIA);
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.controls.classList.toggle('d-none', !this.unlocked);
        this.component.adventureButton.disabled = !this.unlocked;

        this.component.autoRepeatContainer.classList.toggle('d-none', !this.autoRunUnlocked);

        this.renderQueue.clickable = false;
    }

    renderAutoRepeat() {
        if(!this.renderQueue.autoRepeat)
            return;

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