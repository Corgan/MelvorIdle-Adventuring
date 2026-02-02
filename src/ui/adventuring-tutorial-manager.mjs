const { loadModule } = mod.getContext(import.meta);

const { AdventuringTutorialTooltipElement } = await loadModule('src/ui/components/adventuring-tutorial-tooltip.mjs');

export class AdventuringTutorialManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.completedTutorials = new Set();  // Set<AdventuringTutorial>
        this.skippedTutorials = new Set();    // Set<AdventuringTutorial>
        this.skipAll = false;

        this.queue = [];                       // Array<AdventuringTutorial>
        this.activeTutorial = null;            // Currently displaying
        this.activeStepIndex = 0;


        this._elementCache = new Map();

        this.component = createElement('adventuring-tutorial-tooltip');
        this.component.manager = this;

        // Register conductor listeners for tutorial triggers
        this.manager.conductor.listen([
            'encounter_start',
            'dungeon_start', 
            'currency_collected',
            'material_collected',
            'monster_seen',
            'skill_level_up',
            'mastery_level_up'
        ], (type, context) => this.checkTriggers(type, context));
    }

    postDataRegistration() {

        document.body.appendChild(this.component);
    }

    checkTriggers(eventType, context = {}) {
        if(this.skipAll) return;

        this.manager.tutorials.allObjects.forEach(tutorial => {
            if(tutorial.checkTrigger(eventType, context)) {
                this.queueTutorial(tutorial);
            }
        });
    }

    checkAllPendingTutorials() {
        if(this.skipAll) return;

        const eligible = [];

        this.manager.tutorials.allObjects.forEach(tutorial => {

            if(this.completedTutorials.has(tutorial)) return;
            if(this.skippedTutorials.has(tutorial)) return;
            if(this.queue.includes(tutorial)) return;
            if(this.activeTutorial === tutorial) return;

            if(tutorial.trigger && tutorial.trigger.type === 'chained') {

                const parentCompleted = this.manager.tutorials.allObjects.some(parent => {
                    return parent.chainTo === tutorial.id && this.completedTutorials.has(parent);
                });
                if(parentCompleted) {
                    eligible.push(tutorial);
                }
                return;
            }

            if(this.isTutorialEligible(tutorial)) {
                eligible.push(tutorial);
            }
        });

        eligible.sort((a, b) => a.priority - b.priority);

        eligible.forEach(tutorial => this.queueTutorial(tutorial));
    }

    isTutorialEligible(tutorial) {
        if(!tutorial.trigger) return false;
        const triggerType = tutorial.trigger.type;

        switch(triggerType) {
            case 'immediate':
                return true;

            case 'chained':
                return false;

            case 'currency_threshold':
                const currency = this.manager.stash.getCurrency(tutorial.trigger.currencyId || 'currency');
                return currency >= tutorial.trigger.amount;

            case 'material_threshold':
                return this.checkMaterialTrigger(tutorial);

            case 'mastery_level_up':
                return this.checkMasteryTrigger(tutorial);

            case 'skill_level_up':
                return this.manager.level >= tutorial.trigger.level;

            // Direct event triggers are not eligible on page load
            case 'encounter_start':
            case 'dungeon_start':
            case 'monster_seen':
                return false;

            default:
                return false;
        }
    }

    checkMaterialTrigger(tutorial) {
        if(tutorial.trigger.check === 'anyUpgrade') {
            return this.manager.baseItems.allObjects.some(function(item) {
                if(!item.unlocked) return false;
                return item.upgradeable;
            });
        }

        if(tutorial.trigger.check === 'anyCraft') {
            return this.manager.consumableTypes.allObjects.some(function(consumable) {
                if(typeof consumable.canAfford !== 'function') return false;
                return consumable.canAfford();
            });
        }

        if(tutorial.trigger.materials) {
            var manager = this.manager;
            return tutorial.trigger.materials.every(function(req) {
                var material = manager.materials.getObjectByID(req.id);
                if(!material) return false;
                var count = manager.stash.getCount(material);
                return count >= req.amount;
            });
        }

        return false;
    }

    checkMasteryTrigger(tutorial) {
        var category = tutorial.trigger.category;
        var targetLevel = tutorial.trigger.level;

        if(category === 'job') {
            return this.manager.jobs.allObjects.some(function(job) {
                return job.level >= targetLevel;
            });
        }
        if(category === 'area') {
            return this.manager.areas.allObjects.some(function(area) {
                return area.level >= targetLevel;
            });
        }
        if(category === 'equipment') {
            return this.manager.baseItems.allObjects.some(function(item) {
                return item.level >= targetLevel;
            });
        }

        return false;
    }

    queueTutorial(tutorial) {
        if(this.skipAll) return;
        if(this.completedTutorials.has(tutorial)) return;
        if(this.skippedTutorials.has(tutorial)) return;
        if(this.queue.includes(tutorial)) return;
        if(this.activeTutorial === tutorial) return;

        const insertIndex = this.queue.findIndex(t => t.priority > tutorial.priority);
        if(insertIndex === -1) {
            this.queue.push(tutorial);
        } else {
            this.queue.splice(insertIndex, 0, tutorial);
        }

        if(!this.activeTutorial) {
            this.activateNext();
        }
    }

    activateNext() {
        if(this.queue.length === 0) {
            this.activeTutorial = null;
            this.activeStepIndex = 0;
            this.component.hide();
            return;
        }

        this.activeTutorial = this.queue.shift();
        this.activeStepIndex = 0;
        this.showCurrentStep();
    }

    canDisplay(tutorial) {

        var currentPage = this.game.openPage;
        if(!currentPage || currentPage.action !== this.manager) {
            return false;
        }

        if(!tutorial.requiresState) return true;

        switch(tutorial.requiresState) {
            case 'town':
                return !this.manager.isActive;
            case 'dungeon':
                return this.manager.isActive;
            default:
                return true;
        }
    }

    onStateChange() {

        this.clearElementCache();

        if(this.activeTutorial && !this.component._visible) {
            this.showCurrentStep();
        }
    }

    onOverviewPageChange() {

        this.clearElementCache();

        if(this.activeTutorial && !this.component._visible) {
            this.showCurrentStep();
        }
    }

    onPageVisible() {

        this.checkAllPendingTutorials();

        if(this.activeTutorial) {
            this.showCurrentStep();
        }
    }

    onPageHidden() {

        this.component.hide();
        this.clearRetry();
        this.clearElementCache();
    }

    onOfflineLoopExited() {

        setTimeout(() => {

            this.checkAllPendingTutorials();

            var currentPage = this.game.openPage;
            if(currentPage && currentPage.action === this.manager) {
                if(this.activeTutorial) {
                    this.showCurrentStep();
                }
            }
        }, 100);
    }

    shouldSkipStep(step) {
        if(!step || !step.target) return false;

        var parts = step.target.split(':');
        var type = parts[0];
        var value = parts[1];

        switch(type) {
            case 'page':

                return this.manager.overview.activePage === value;

            case 'building':

                var building = this.manager.buildings.getObjectByID(this.manager.namespace + ':' + value);
                if(!building || !building.page) return false;
                return this.manager.overview.activePage === building.page;

            case 'backToTown':

                return this.manager.overview.activePage === 'town';

            case 'area':
            case 'difficultyButton':
            case 'adventureButton':
            case 'autoRepeat':
                return false;

            case 'dungeonFloor':
            case 'turnOrderCards':
            case 'turnProgressBar':
            case 'combatLog':
            case 'dungeon':
                return false;

            default:
                return false;
        }
    }

    showCurrentStep() {
        if(!this.activeTutorial) {
            return;
        }

        if(!confirmedLoaded) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        if(!inFocus) {
            this.component.hide();

            return;
        }

        if(loadingOfflineProgress) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        if(Swal.isVisible()) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        const offlineModal = document.getElementById('modal-offline-loading');
        if(offlineModal && offlineModal.classList.contains('show')) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        if(!this.canDisplay(this.activeTutorial)) {

            this.component.hide();
            return;
        }

        var step = this.activeTutorial.steps[this.activeStepIndex];

        if(!step) {
            this.completeTutorial();
            return;
        }

        if(this.shouldSkipStep(step)) {
            this.activeStepIndex++;
            this.showCurrentStep();
            return;
        }

        var targetElement = step.target ? this.resolveTarget(step.target) : null;

        if(step.target && !targetElement) {
            if(!this.isOnCorrectPageForTarget(step.target)) {

                this.component.hide();
                return;
            }

            this.scheduleRetry();
            return;
        }

        this.clearRetry();

        this.component.show(targetElement, step.message, step.position);
    }

    scheduleRetry() {
        this.clearRetry();
        this._retryTimeout = setTimeout(() => {
            this._retryTimeout = null;
            this.showCurrentStep();
        }, 100); // Single retry after 100ms for render
    }

    clearRetry() {
        if(this._retryTimeout) {
            clearTimeout(this._retryTimeout);
            this._retryTimeout = null;
        }
    }

    isOnCorrectPageForTarget(target) {
        if(!target) return true;

        const [type] = target.split(':');

        switch(type) {

            case 'area':
            case 'difficultyButton':
            case 'adventureButton':
            case 'autoRepeat':
                return this.manager.overview.activePage === 'crossroads';

            case 'dungeonFloor':
                return this.manager.isActive && !this.manager.encounter.isFighting;

            case 'turnOrderCards':
            case 'turnProgressBar':
            case 'combatLog':
            case 'combatAbilities':
                return this.manager.isActive && this.manager.encounter.isFighting;

            case 'dungeon':
                return this.manager.isActive;

            case 'building':
                return this.manager.overview.activePage === 'town';

            case 'drink':
                return this.manager.overview.activePage === 'tavern';

            case 'consumable':
                return this.manager.overview.activePage === 'alchemist';

            case 'item':
                return this.manager.overview.activePage === 'armory';

            default:
                return true;
        }
    }

    _isCachedElementValid(element) {
        if (!element) return false;
        return document.body.contains(element);
    }

    _getCachedElement(target) {
        if (!this._elementCache.has(target)) return null;

        var cached = this._elementCache.get(target);
        if (this._isCachedElementValid(cached)) {
            return cached;
        }

        this._elementCache.delete(target);
        return null;
    }

    _cacheElement(target, element) {
        if (element) {
            this._elementCache.set(target, element);
        }
    }

    clearElementCache() {
        this._elementCache.clear();
    }

    resolveTarget(target) {
        if(!target) return null;

        var cached = this._getCachedElement(target);
        if (cached) return cached;

        var result = this._resolveTargetUncached(target);


        if (result && target.indexOf(':any') === -1) {
            this._cacheElement(target, result);
        }

        return result;
    }

    _resolveTargetUncached(target) {

        if(target.startsWith('#') || target.startsWith('.')) {
            return document.querySelector(target);
        }

        const [type, value] = target.split(':');

        switch(type) {
            case 'page':

                return this.manager.overview.getButtonElement(value);

            case 'hero':

                var heroIndex = parseInt(value);
                var hero = this.manager.party.all[heroIndex];
                if(!hero) return null;
                return hero.component;

            case 'combatJob':

                var combatJobIndex = parseInt(value);
                var combatJobHero = this.manager.party.all[combatJobIndex];
                if(!combatJobHero || !combatJobHero.component) return null;
                return combatJobHero.component.combatJob;

            case 'passiveJob':

                var passiveJobIndex = parseInt(value);
                var passiveJobHero = this.manager.party.all[passiveJobIndex];
                if(!passiveJobHero || !passiveJobHero.component) return null;
                return passiveJobHero.component.passiveJob;

            case 'job':

                if(value === 'any') {

                    return document.querySelector('.tippy-box .pointer-enabled.bg-combat-inner-dark') ||
                           document.querySelector('.tippy-box .pointer-enabled.adventuring-selected');
                }
                return document.querySelector('adventuring-job-small[data-id="' + value + '"]');

            case 'ability':

                var abilityParts = value.split(':');
                var heroIdx = parseInt(abilityParts[0]) || 0;
                var slotIdx = abilityParts.length > 1 ? parseInt(abilityParts[1]) : 0;
                var abilityHero = this.manager.party.all[heroIdx];
                if(!abilityHero || !abilityHero.component) return null;
                return slotIdx === 0 ? abilityHero.component.generator : abilityHero.component.spender;

            case 'combatAbilities':

                var abilitiesHeroIdx = value === 'any' ? 0 : parseInt(value) || 0;
                var abilitiesHero = this.manager.party.all[abilitiesHeroIdx];
                if(!abilitiesHero || !abilitiesHero.component) return null;
                return abilitiesHero.component.abilities;

            case 'item':

                return this.manager.armory.component.querySelector('[data-slot="' + value + '"]');

            case 'drink':

                if(value === 'any') {

                    var tavernDrinks = this.manager.tavern.component.drinks;
                    if(tavernDrinks && tavernDrinks.firstElementChild) {

                        return tavernDrinks.firstElementChild.querySelector('.block-rounded-double') ||
                               tavernDrinks.firstElementChild;
                    }
                }
                return null;

            case 'consumable':

                if(value === 'any') {
                    return document.querySelector('adventuring-consumable');
                }
                return null;

            case 'area':

                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {
                    return document.querySelector('adventuring-area');
                }

                var specificArea = this.manager.areas.getObjectByID(this.manager.namespace + ':' + value);
                if(specificArea && specificArea.component) {
                    return specificArea.component;
                }
                return null;

            case 'difficultyButton':

                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {

                    for(var da of this.manager.crossroads.areas) {
                        if(da.unlocked && da.component && da.component.difficultyButton) {
                            return da.component.difficultyButton;
                        }
                    }
                }
                return null;

            case 'difficultyOption':


                var dropdownItems = document.querySelectorAll('.dropdown-menu.show .dropdown-item');
                for(var di of dropdownItems) {
                    if(di.textContent.toLowerCase().includes(value.toLowerCase())) {
                        return di;
                    }
                }
                return null;

            case 'adventureButton':

                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {
                    for(var aa of this.manager.crossroads.areas) {
                        if(aa.unlocked && aa.component && aa.component.adventureButton) {
                            return aa.component.adventureButton;
                        }
                    }
                }
                return null;

            case 'autoRepeat':

                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {

                    for(var ar of this.manager.crossroads.areas) {
                        if(ar.autoRunUnlocked && ar.component && ar.component.autoRepeatContainer) {
                            return ar.component.autoRepeatContainer;
                        }
                    }
                }
                return null;

            case 'building':

                var buildingObj = this.manager.buildings.getObjectByID(this.manager.namespace + ':' + value);
                if(!buildingObj) return null;
                return buildingObj.component;

            case 'backToTown':

                return document.querySelector('#back[class*="btn"]') ||
                       document.querySelector('button#back');

            case 'dungeon':

                if(!this.manager.isActive) return null;
                if(value === 'any') {
                    return document.querySelector('adventuring-dungeon-cell');
                }
                return null;

            case 'dungeonFloor':

                if(!this.manager.isActive) return null;
                if(this.manager.encounter.isFighting) return null;
                return this.manager.dungeon.component.dungeon;

            case 'turnOrderCards':

                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.cards;

            case 'turnProgressBar':

                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.turnProgress;

            case 'statusText':

                return this.manager.overview.component.statusText;

            case 'combatLog':

                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.log;

            case 'element':

                return document.getElementById(value);

            default:
                return document.querySelector(target);
        }
    }

    advanceStep() {
        this.clearRetry();
        this.activeStepIndex++;

        if(this.activeStepIndex >= this.activeTutorial.steps.length) {
            this.completeTutorial();
        } else {
            this.showCurrentStep();
        }
    }

    completeTutorial() {
        if(!this.activeTutorial) return;

        this.clearRetry();
        const completed = this.activeTutorial;
        this.completedTutorials.add(completed);

        if(completed.chainTo) {
            const chainedTutorial = this.manager.tutorials.getObjectByID(completed.chainTo);
            if(chainedTutorial && !this.completedTutorials.has(chainedTutorial) && !this.skippedTutorials.has(chainedTutorial)) {

                this.queue.unshift(chainedTutorial);
            }
        }

        this.activeTutorial = null;
        this.activeStepIndex = 0;

        this.checkAllPendingTutorials();

        this.activateNext();
    }

    skipTutorial() {
        if(!this.activeTutorial) return;

        this.skippedTutorials.add(this.activeTutorial);
        this.activeTutorial = null;
        this.activeStepIndex = 0;
        this.component.hide();
        this.activateNext();
    }

    setSkipAll(skip) {
        this.skipAll = skip;
        if(skip) {
            this.queue = [];
            this.activeTutorial = null;
            this.activeStepIndex = 0;
            this.component.hide();
        }
    }

    isCompleted(tutorialId) {
        const tutorial = this.manager.tutorials.getObjectByID(tutorialId);
        return tutorial && this.completedTutorials.has(tutorial);
    }

    resetState() {
        this.skipAll = false;
        this.completedTutorials.clear();
        this.skippedTutorials.clear();
        this.queue = [];
        this.activeTutorial = null;
        this.activeStepIndex = 0;
    }

    encode(writer) {
        writer.writeBoolean(this.skipAll);

        writer.writeSet(this.completedTutorials, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        writer.writeSet(this.skippedTutorials, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        writer.writeArray(this.queue, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        writer.writeBoolean(this.activeTutorial !== null);
        if(this.activeTutorial) {
            writer.writeNamespacedObject(this.activeTutorial);
            writer.writeUint32(this.activeStepIndex);
        }
    }

    decode(reader, version) {
        this.skipAll = reader.getBoolean();

        reader.getSet((r) => {
            const tutorial = r.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.completedTutorials.add(tutorial);
            }
        });

        reader.getSet((r) => {
            const tutorial = r.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.skippedTutorials.add(tutorial);
            }
        });

        this.queue = [];
        const queueLength = reader.getUint32();
        for(let i = 0; i < queueLength; i++) {
            const tutorial = reader.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.queue.push(tutorial);
            }
        }

        if(reader.getBoolean()) {
            const tutorial = reader.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.activeTutorial = tutorial;
                this.activeStepIndex = reader.getUint32();
            } else {
                reader.getUint32(); // Skip the step index if tutorial not found
            }
        }
    }
}
