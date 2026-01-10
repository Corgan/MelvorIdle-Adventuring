const { loadModule } = mod.getContext(import.meta);

const { AdventuringTutorialTooltipElement } = await loadModule('src/ui/components/adventuring-tutorial-tooltip.mjs');

export class AdventuringTutorialManager {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        // State
        this.completedTutorials = new Set();  // Set<AdventuringTutorial>
        this.skippedTutorials = new Set();    // Set<AdventuringTutorial>
        this.skipAll = false;

        // Queue system
        this.queue = [];                       // Array<AdventuringTutorial>
        this.activeTutorial = null;            // Currently displaying
        this.activeStepIndex = 0;
        
        // Element cache for target resolution (key: target string, value: element)
        // Cached elements are validated before use (must still be in DOM)
        this._elementCache = new Map();

        // UI Component
        this.component = createElement('adventuring-tutorial-tooltip');
        this.component.manager = this;
    }

    /**
     * Called after data registration to set up initial state
     */
    postDataRegistration() {
        // Mount component to document body for proper z-index layering
        document.body.appendChild(this.component);
    }

    /**
     * Check all tutorials for matching triggers
     * @param {string} triggerType - Type of trigger event
     * @param {object} context - Additional context
     */
    checkTriggers(triggerType, context = {}) {
        if(this.skipAll) return;

        this.manager.tutorials.allObjects.forEach(tutorial => {
            if(tutorial.checkTrigger(triggerType, context)) {
                this.queueTutorial(tutorial);
            }
        });
    }

    /**
     * Check ALL tutorials that haven't been completed and meet their requirements
     * This is used on page visible and after tutorial completion to catch any
     * tutorials whose conditions became true while not viewing the page
     */
    checkAllPendingTutorials() {
        if(this.skipAll) return;

        // Collect all eligible tutorials
        const eligible = [];

        this.manager.tutorials.allObjects.forEach(tutorial => {
            // Skip completed/skipped/queued/active
            if(this.completedTutorials.has(tutorial)) return;
            if(this.skippedTutorials.has(tutorial)) return;
            if(this.queue.includes(tutorial)) return;
            if(this.activeTutorial === tutorial) return;

            // For chained tutorials, check if the parent tutorial is completed
            if(tutorial.trigger && tutorial.trigger.type === 'chained') {
                // Find tutorials that chain to this one
                const parentCompleted = this.manager.tutorials.allObjects.some(parent => {
                    return parent.chainTo === tutorial.id && this.completedTutorials.has(parent);
                });
                if(parentCompleted) {
                    eligible.push(tutorial);
                }
                return;
            }

            // Check if trigger conditions are met
            if(this.isTutorialEligible(tutorial)) {
                eligible.push(tutorial);
            }
        });

        // Sort by priority (lower = higher priority)
        eligible.sort((a, b) => a.priority - b.priority);

        // Queue all eligible
        eligible.forEach(tutorial => this.queueTutorial(tutorial));
    }

    /**
     * Check if a tutorial's trigger conditions are currently met
     * @param {AdventuringTutorial} tutorial
     * @returns {boolean}
     */
    isTutorialEligible(tutorial) {
        if(!tutorial.trigger) return false;

        switch(tutorial.trigger.type) {
            case 'immediate':
                return true;

            case 'chained':
                return false;

            case 'currency':
                const currency = this.manager.stash.getCurrency(tutorial.trigger.currencyId || 'currency');
                return currency >= tutorial.trigger.amount;

            case 'material':
                return this.checkMaterialTrigger(tutorial);

            case 'mastery':
                // Check if any mastery of the right category meets the level
                return this.checkMasteryTrigger(tutorial);

            case 'skillLevel':
                return this.manager.level >= tutorial.trigger.level;

            case 'event':
                // Events are transient, they've either been triggered or not
                // This returns false since we'd have caught it when it happened
                return false;

            default:
                return false;
        }
    }

    /**
     * Check material-based triggers
     */
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

    /**
     * Check mastery-based triggers
     */
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

    /**
     * Add tutorial to queue if not completed/skipped
     * Maintains priority order
     */
    queueTutorial(tutorial) {
        if(this.skipAll) return;
        if(this.completedTutorials.has(tutorial)) return;
        if(this.skippedTutorials.has(tutorial)) return;
        if(this.queue.includes(tutorial)) return;
        if(this.activeTutorial === tutorial) return;

        // Insert by priority (lower = higher priority)
        const insertIndex = this.queue.findIndex(t => t.priority > tutorial.priority);
        if(insertIndex === -1) {
            this.queue.push(tutorial);
        } else {
            this.queue.splice(insertIndex, 0, tutorial);
        }

        // Start if nothing active
        if(!this.activeTutorial) {
            this.activateNext();
        }
    }

    /**
     * Activate the next tutorial in queue
     */
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

    /**
     * Check if a tutorial's display conditions are met
     * @param {AdventuringTutorial} tutorial
     * @returns {boolean}
     */
    canDisplay(tutorial) {
        // Must be on the adventuring page
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

    /**
     * Called when game state changes (town/dungeon) to check waiting tutorials
     */
    onStateChange() {
        // Clear element cache since DOM has changed
        this.clearElementCache();
        
        // If we have an active tutorial waiting to display, try again
        if(this.activeTutorial && !this.component._visible) {
            this.showCurrentStep();
        }
    }

    /**
     * Called when the overview page changes (e.g., town -> crossroads)
     */
    onOverviewPageChange() {
        // Clear element cache since DOM has changed
        this.clearElementCache();
        
        // If we have an active tutorial waiting to display, try again
        if(this.activeTutorial && !this.component._visible) {
            this.showCurrentStep();
        }
    }

    /**
     * Called when the adventuring page becomes visible
     */
    onPageVisible() {
        // Check ALL tutorials that might be eligible now
        this.checkAllPendingTutorials();

        // If we have an active tutorial, try to show it
        if(this.activeTutorial) {
            this.showCurrentStep();
        }
    }

    /**
     * Called when leaving the adventuring page
     */
    onPageHidden() {
        // Hide tooltip when leaving the page
        this.component.hide();
        this.clearRetry();
        this.clearElementCache();
    }

    /**
     * Called when offline progress loop completes
     * This ensures tutorials are checked after the game is fully loaded
     */
    onOfflineLoopExited() {
        // Small delay to ensure UI is fully rendered
        setTimeout(() => {
            // Always check and queue tutorials (e.g., immediate tutorials on new saves)
            this.checkAllPendingTutorials();
            
            // Only show if we're currently on the adventuring page
            var currentPage = this.game.openPage;
            if(currentPage && currentPage.action === this.manager) {
                if(this.activeTutorial) {
                    this.showCurrentStep();
                }
            }
        }, 100);
    }

    /**
     * Check if a step should be auto-skipped because its target is already active
     * @param {Object} step - The tutorial step
     * @returns {boolean}
     */
    shouldSkipStep(step) {
        if(!step || !step.target) return false;

        var parts = step.target.split(':');
        var type = parts[0];
        var value = parts[1];

        switch(type) {
            case 'page':
                // Skip if already on this page
                return this.manager.overview.activePage === value;

            case 'building':
                // Skip if the building's page is already open
                var building = this.manager.buildings.getObjectByID(this.manager.namespace + ':' + value);
                if(!building || !building.page) return false;
                return this.manager.overview.activePage === building.page;

            case 'backToTown':
                // Skip if already on town overview (not inside a building page)
                return this.manager.overview.activePage === 'town';

            // Crossroads targets - wait for user to navigate there (don't skip)
            case 'area':
            case 'difficultyButton':
            case 'adventureButton':
            case 'autoRepeat':
                return false;

            // Dungeon targets - wait for user to be in dungeon (don't skip)
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

    /**
     * Display the current step of the active tutorial
     */
    showCurrentStep() {
        if(!this.activeTutorial) {
            return;
        }

        // Don't show tutorial until game is fully loaded
        if(!confirmedLoaded) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        // Don't show tutorial if window is not in focus
        if(!inFocus) {
            this.component.hide();
            // Don't retry here - onPageVisible will handle it when focus returns
            return;
        }

        // Don't show tutorial while loading offline progress
        if(loadingOfflineProgress) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        // Don't show tutorial if Swal (offline progress summary, etc.) is visible
        if(Swal.isVisible()) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        // Don't show tutorial if offline loading modal is visible
        const offlineModal = document.getElementById('modal-offline-loading');
        if(offlineModal && offlineModal.classList.contains('show')) {
            this.component.hide();
            this.scheduleRetry();
            return;
        }

        // Check if we can display this tutorial in current state
        if(!this.canDisplay(this.activeTutorial)) {
            // Hide tooltip and wait for state change
            this.component.hide();
            return;
        }

        var step = this.activeTutorial.steps[this.activeStepIndex];
        
        if(!step) {
            this.completeTutorial();
            return;
        }

        // Auto-skip steps whose targets are already active
        if(this.shouldSkipStep(step)) {
            this.activeStepIndex++;
            this.showCurrentStep();
            return;
        }

        // Resolve target element for visual highlighting (optional)
        var targetElement = step.target ? this.resolveTarget(step.target) : null;
        
        // If target specified but not found, check if we're on wrong page
        if(step.target && !targetElement) {
            if(!this.isOnCorrectPageForTarget(step.target)) {
                // Wrong page - wait for page change event
                this.component.hide();
                return;
            }
            // Right page but element not rendered yet - schedule retry
            this.scheduleRetry();
            return;
        }

        // Clear any pending retry
        this.clearRetry();

        // Show the tooltip (target is optional - used for highlighting only)
        this.component.show(targetElement, step.message, step.position);
    }

    /**
     * Schedule a retry to find the target element (one-time, not polling)
     */
    scheduleRetry() {
        this.clearRetry();
        this._retryTimeout = setTimeout(() => {
            this._retryTimeout = null;
            this.showCurrentStep();
        }, 100); // Single retry after 100ms for render
    }

    /**
     * Clear any pending retry
     */
    clearRetry() {
        if(this._retryTimeout) {
            clearTimeout(this._retryTimeout);
            this._retryTimeout = null;
        }
    }

    /**
     * Check if we're on the correct page for a given target
     * @param {string} target - The target string
     * @returns {boolean}
     */
    isOnCorrectPageForTarget(target) {
        if(!target) return true;
        
        const [type] = target.split(':');
        
        switch(type) {
            // Crossroads targets require crossroads page
            case 'area':
            case 'difficultyButton':
            case 'adventureButton':
            case 'autoRepeat':
                return this.manager.overview.activePage === 'crossroads';
            
            // Dungeon exploration targets require being in dungeon but NOT in combat
            case 'dungeonFloor':
                return this.manager.isActive && !this.manager.encounter.isFighting;
            
            // Combat targets require being in combat
            case 'turnOrderCards':
            case 'turnProgressBar':
            case 'combatLog':
            case 'combatAbilities':
                return this.manager.isActive && this.manager.encounter.isFighting;
            
            // General dungeon target
            case 'dungeon':
                return this.manager.isActive;
            
            // Building targets require town page
            case 'building':
                return this.manager.overview.activePage === 'town';
            
            // Drink targets require being in tavern
            case 'drink':
                return this.manager.overview.activePage === 'tavern';
            
            // Consumable targets require being in alchemist
            case 'consumable':
                return this.manager.overview.activePage === 'alchemist';
            
            // Item targets require being in armory
            case 'item':
                return this.manager.overview.activePage === 'armory';
            
            default:
                return true;
        }
    }

    /**
     * Check if a cached element is still valid (in the DOM)
     * @param {HTMLElement} element
     * @returns {boolean}
     */
    _isCachedElementValid(element) {
        if (!element) return false;
        return document.body.contains(element);
    }
    
    /**
     * Get an element from cache if valid, or null
     * @param {string} target
     * @returns {HTMLElement|null}
     */
    _getCachedElement(target) {
        if (!this._elementCache.has(target)) return null;
        
        var cached = this._elementCache.get(target);
        if (this._isCachedElementValid(cached)) {
            return cached;
        }
        
        // Invalid cache entry, remove it
        this._elementCache.delete(target);
        return null;
    }
    
    /**
     * Cache an element for a target
     * @param {string} target
     * @param {HTMLElement} element
     */
    _cacheElement(target, element) {
        if (element) {
            this._elementCache.set(target, element);
        }
    }
    
    /**
     * Clear the element cache (call on page changes)
     */
    clearElementCache() {
        this._elementCache.clear();
    }

    /**
     * Resolve a target string to a DOM element
     * @param {string} target - Target identifier (e.g., "page:trainer", "hero:0", "#css-selector")
     * @returns {HTMLElement|null}
     */
    resolveTarget(target) {
        if(!target) return null;
        
        // Check cache first
        var cached = this._getCachedElement(target);
        if (cached) return cached;
        
        var result = this._resolveTargetUncached(target);
        
        // Cache the result for stable targets
        // Don't cache 'any' targets as they may change
        if (result && target.indexOf(':any') === -1) {
            this._cacheElement(target, result);
        }
        
        return result;
    }
    
    /**
     * Internal: resolve target without caching
     * @param {string} target
     * @returns {HTMLElement|null}
     */
    _resolveTargetUncached(target) {
        // Direct CSS selector
        if(target.startsWith('#') || target.startsWith('.')) {
            return document.querySelector(target);
        }

        const [type, value] = target.split(':');

        switch(type) {
            case 'page':
                // Overview page button
                return this.manager.overview.getButtonElement(value);

            case 'hero':
                // Hero in party
                var heroIndex = parseInt(value);
                var hero = this.manager.party.all[heroIndex];
                if(!hero) return null;
                return hero.component;

            case 'combatJob':
                // Combat job selector on hero
                var combatJobIndex = parseInt(value);
                var combatJobHero = this.manager.party.all[combatJobIndex];
                if(!combatJobHero || !combatJobHero.component) return null;
                return combatJobHero.component.combatJob;

            case 'passiveJob':
                // Passive job selector on hero
                var passiveJobIndex = parseInt(value);
                var passiveJobHero = this.manager.party.all[passiveJobIndex];
                if(!passiveJobHero || !passiveJobHero.component) return null;
                return passiveJobHero.component.passiveJob;

            case 'job':
                // Job in selector popup - jobs are rendered as divs inside tippy popup
                if(value === 'any') {
                    // Look for job buttons inside tippy popup (they have pointer-enabled and bg-combat-inner-dark classes)
                    return document.querySelector('.tippy-box .pointer-enabled.bg-combat-inner-dark') ||
                           document.querySelector('.tippy-box .pointer-enabled.adventuring-selected');
                }
                return document.querySelector('adventuring-job-small[data-id="' + value + '"]');

            case 'ability':
                // Ability slot on hero - format is heroIndex:slotIndex (e.g., ability:0:0 = hero 0 generator)
                var abilityParts = value.split(':');
                var heroIdx = parseInt(abilityParts[0]) || 0;
                var slotIdx = abilityParts.length > 1 ? parseInt(abilityParts[1]) : 0;
                var abilityHero = this.manager.party.all[heroIdx];
                if(!abilityHero || !abilityHero.component) return null;
                return slotIdx === 0 ? abilityHero.component.generator : abilityHero.component.spender;

            case 'combatAbilities':
                // Combat abilities section on a hero (format: combatAbilities:heroIndex or combatAbilities:any)
                var abilitiesHeroIdx = value === 'any' ? 0 : parseInt(value) || 0;
                var abilitiesHero = this.manager.party.all[abilitiesHeroIdx];
                if(!abilitiesHero || !abilitiesHero.component) return null;
                return abilitiesHero.component.abilities;

            case 'item':
                // Equipment slot in armory
                return this.manager.armory.component.querySelector('[data-slot="' + value + '"]');

            case 'drink':
                // Drink in tavern - drink cards are inside the #drinks container
                if(value === 'any') {
                    // Look for drink cards in tavern
                    var tavernDrinks = this.manager.tavern.component.drinks;
                    if(tavernDrinks && tavernDrinks.firstElementChild) {
                        // Return the card inside the col wrapper
                        return tavernDrinks.firstElementChild.querySelector('.block-rounded-double') || 
                               tavernDrinks.firstElementChild;
                    }
                }
                return null;

            case 'consumable':
                // Consumable in crafting
                if(value === 'any') {
                    return document.querySelector('adventuring-consumable');
                }
                return null;

            case 'area':
                // Area in crossroads - only valid on crossroads page
                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {
                    return document.querySelector('adventuring-area');
                }
                // Specific area by ID
                var specificArea = this.manager.areas.getObjectByID(this.manager.namespace + ':' + value);
                if(specificArea && specificArea.component) {
                    return specificArea.component;
                }
                return null;

            case 'difficultyButton':
                // Difficulty dropdown button on an area - only valid on crossroads page
                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {
                    // Find first area with difficulty unlocked
                    for(var da of this.manager.crossroads.areas) {
                        if(da.unlocked && da.component && da.component.difficultyButton) {
                            return da.component.difficultyButton;
                        }
                    }
                }
                return null;

            case 'difficultyOption':
                // Difficulty option in dropdown (e.g., difficultyOption:heroic)
                // Look for open dropdown with the difficulty name
                var dropdownItems = document.querySelectorAll('.dropdown-menu.show .dropdown-item');
                for(var di of dropdownItems) {
                    if(di.textContent.toLowerCase().includes(value.toLowerCase())) {
                        return di;
                    }
                }
                return null;

            case 'adventureButton':
                // Adventure button on an area - only valid on crossroads page
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
                // Auto-repeat checkbox on an area - only valid on crossroads page
                if(this.manager.overview.activePage !== 'crossroads') return null;
                if(value === 'any') {
                    // Find first area with auto-repeat unlocked
                    for(var ar of this.manager.crossroads.areas) {
                        if(ar.autoRunUnlocked && ar.component && ar.component.autoRepeatContainer) {
                            return ar.component.autoRepeatContainer;
                        }
                    }
                }
                return null;

            case 'building':
                // Building card in town page
                var buildingObj = this.manager.buildings.getObjectByID(this.manager.namespace + ':' + value);
                if(!buildingObj) return null;
                return buildingObj.component;

            case 'backToTown':
                // Find the "Back to Town" button in any building page
                return document.querySelector('#back[class*="btn"]') ||
                       document.querySelector('button#back');

            case 'dungeon':
                // Dungeon cell - only valid when in dungeon
                if(!this.manager.isActive) return null;
                if(value === 'any') {
                    return document.querySelector('adventuring-dungeon-cell');
                }
                return null;

            case 'dungeonFloor':
                // The dungeon floor grid - only valid when in dungeon and not in combat
                if(!this.manager.isActive) return null;
                if(this.manager.encounter.isFighting) return null;
                return this.manager.dungeon.component.dungeon;

            case 'turnOrderCards':
                // The turn order card display - only valid when in combat
                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.cards;

            case 'turnProgressBar':
                // The turn timer progress bar - only valid when in combat
                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.turnProgress;

            case 'statusText':
                // The status text at top
                return this.manager.overview.component.statusText;

            case 'combatLog':
                // The combat log panel - only valid when in combat
                if(!this.manager.isActive) return null;
                if(!this.manager.encounter.isFighting) return null;
                return this.manager.overview.component.log;

            case 'element':
                // Generic element by ID
                return document.getElementById(value);

            default:
                return document.querySelector(target);
        }
    }

    /**
     * Advance to the next step
     */
    advanceStep() {
        this.clearRetry();
        this.activeStepIndex++;

        if(this.activeStepIndex >= this.activeTutorial.steps.length) {
            this.completeTutorial();
        } else {
            this.showCurrentStep();
        }
    }

    /**
     * Complete the current tutorial
     */
    completeTutorial() {
        if(!this.activeTutorial) return;

        this.clearRetry();
        const completed = this.activeTutorial;
        this.completedTutorials.add(completed);

        // Check for chained tutorial
        if(completed.chainTo) {
            const chainedTutorial = this.manager.tutorials.getObjectByID(completed.chainTo);
            if(chainedTutorial && !this.completedTutorials.has(chainedTutorial) && !this.skippedTutorials.has(chainedTutorial)) {
                // Insert at front of queue
                this.queue.unshift(chainedTutorial);
            }
        }

        this.activeTutorial = null;
        this.activeStepIndex = 0;

        // Check for other tutorials that might now be eligible
        this.checkAllPendingTutorials();

        this.activateNext();
    }

    /**
     * Skip the current tutorial
     */
    skipTutorial() {
        if(!this.activeTutorial) return;

        this.skippedTutorials.add(this.activeTutorial);
        this.activeTutorial = null;
        this.activeStepIndex = 0;
        this.component.hide();
        this.activateNext();
    }

    /**
     * Skip all tutorials
     */
    setSkipAll(skip) {
        this.skipAll = skip;
        if(skip) {
            this.queue = [];
            this.activeTutorial = null;
            this.activeStepIndex = 0;
            this.component.hide();
        }
    }

    /**
     * Check if a specific tutorial is completed
     */
    isCompleted(tutorialId) {
        const tutorial = this.manager.tutorials.getObjectByID(tutorialId);
        return tutorial && this.completedTutorials.has(tutorial);
    }

    /**
     * Reset all tutorial state (for skill reset)
     */
    resetState() {
        this.skipAll = false;
        this.completedTutorials.clear();
        this.skippedTutorials.clear();
        this.queue = [];
        this.activeTutorial = null;
        this.activeStepIndex = 0;
    }

    /**
     * Encode save data
     */
    encode(writer) {
        writer.writeBoolean(this.skipAll);

        // Completed tutorials
        writer.writeSet(this.completedTutorials, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        // Skipped tutorials
        writer.writeSet(this.skippedTutorials, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        // Queue
        writer.writeArray(this.queue, (tutorial, w) => {
            w.writeNamespacedObject(tutorial);
        });

        // Active state
        writer.writeBoolean(this.activeTutorial !== null);
        if(this.activeTutorial) {
            writer.writeNamespacedObject(this.activeTutorial);
            writer.writeUint32(this.activeStepIndex);
        }
    }

    /**
     * Decode save data
     */
    decode(reader, version) {
        this.skipAll = reader.getBoolean();

        // Completed tutorials
        reader.getSet((r) => {
            const tutorial = r.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.completedTutorials.add(tutorial);
            }
        });

        // Skipped tutorials
        reader.getSet((r) => {
            const tutorial = r.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.skippedTutorials.add(tutorial);
            }
        });

        // Queue
        this.queue = [];
        const queueLength = reader.getUint32();
        for(let i = 0; i < queueLength; i++) {
            const tutorial = reader.getNamespacedObject(this.manager.tutorials);
            if(tutorial && typeof tutorial !== 'string') {
                this.queue.push(tutorial);
            }
        }

        // Active state
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
