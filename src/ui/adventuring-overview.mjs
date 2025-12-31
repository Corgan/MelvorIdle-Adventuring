const { loadModule, getResourceUrl } = mod.getContext(import.meta);

const { AdventuringCards } = await loadModule('src/progression/adventuring-cards.mjs');
const { describeEffect } = await loadModule('src/core/adventuring-utils.mjs');

const { AdventuringOverviewElement } = await loadModule('src/ui/components/adventuring-overview.mjs');
const { AdventuringOverviewButtonElement } = await loadModule('src/ui/components/adventuring-overview-button.mjs');
const { AdventuringEffectIconElement } = await loadModule('src/ui/components/adventuring-effect-icon.mjs');

class AdventuringOverviewButton {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.data = data;
        this.component = createElement('adventuring-overview-button');

        this.component.button.onclick = () => this.clicked();
    }

    clicked() {
        if(this.data.page !== undefined) {
            let page = this.page;
            if(page !== undefined) {
                if(this.data.pageFn !== undefined && page[this.data.pageFn] !== undefined) {
                    page[this.data.pageFn]();
                } else {
                    page.go();
                }
            }
        }
    }

    get page() {
        return this.manager.pages.byId.get(this.data.page);
    }
    
    get active() {
        if(this.data.page !== undefined)
            if(this.page.active)
                return true;
        return false;
    }

    get name() {
        if(this.manager.isActive && this.data.states !== undefined && this.data.states.active !== undefined && this.data.states.active.name !== undefined)
            return this.data.states.active.name;
        if(!this.manager.isActive && this.data.states !== undefined && this.data.states.passive !== undefined && this.data.states.passive.name !== undefined)
            return this.data.states.passive.name;
        return this.data.name !== undefined ? this.data.name : this.page.name;
    }

    get media() {
        if(this.manager.isActive && this.data.states !== undefined && this.data.states.active !== undefined && this.data.states.active.media !== undefined)
            return getResourceUrl(this.data.states.active.media);
        if(!this.manager.isActive && this.data.states !== undefined && this.data.states.passive !== undefined && this.data.states.passive.media !== undefined)
            return getResourceUrl(this.data.states.passive.media);
        return this.data.media !== undefined ? getResourceUrl(this.data.media) : this.page.media;
    }

    render() {
        if(this.data.states !== undefined && this.data.states.active !== undefined)
            this.component.button.classList.toggle(this.data.states.active.className, this.manager.isActive);
        if(this.data.states !== undefined && this.data.states.passive !== undefined)
            this.component.button.classList.toggle(this.data.states.passive.className, !this.manager.isActive);

        this.component.button.classList.toggle('btn-info', this.active);
        this.component.nameText.textContent = this.name;
        this.component.icon.src = this.media;
    }
}

class OverviewRenderQueue {
    constructor() {
        this.status = false;
        this.buttons = false;
        this.turnProgressBar = false;
        this.buffs = false;
    }
}

export class AdventuringOverview {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.renderQueue = new OverviewRenderQueue();
        this.component = createElement('adventuring-overview');

        this.buttons = new Set();

        this.cards = new AdventuringCards(this.manager, this.game);
        
        this.cards.component.mount(this.component.cards);
    }

    /**
     * Get the current page ID for tutorial targeting
     * @returns {string|null}
     */
    get activePage() {
        const current = this.manager.pages.current;
        if(!current) return null;
        
        // Find the page ID from the byId map
        for(const [id, page] of this.manager.pages.byId) {
            if(page === current) return id;
        }
        return null;
    }

    onLoad() {
        this.renderQueue.status = true;
        this.renderQueue.buttons = true;
        this.renderQueue.turnProgressBar = true;
        this.renderQueue.buffs = true;
    }

    registerData(data) {
        if(data.buttons !== undefined) {
            data.buttons.forEach(buttonData => {
                let button = new AdventuringOverviewButton(this.manager, this.game, buttonData);
                button.component.mount(this.component.buttons);
                this.buttons.add(button);
            });
        }
    }

    postDataRegistration() {

    }

    /**
     * Get a button element by its page ID (for tutorial targeting)
     * @param {string} pageId - The page ID (e.g., 'trainer', 'crossroads')
     * @returns {HTMLElement|null}
     */
    getButtonElement(pageId) {
        for(const button of this.buttons) {
            if(button.data.page === pageId) {
                return button.component.button || button.component;
            }
        }
        return null;
    }

    render() {
        this.renderButtons();
        this.renderStatus();
        this.renderTurnProgress();
        this.renderBuffs();
        this.cards.render();
    }

    renderButtons() {
        if(!this.renderQueue.buttons)
            return;

        this.buttons.forEach(button => button.render());

        this.component.cards.classList.toggle('d-none', false && !this.manager.isActive);

        this.renderQueue.buttons = false;
    }

    renderStatus() {
        if(!this.renderQueue.status)
            return;

        let status = '';

        if(this.manager.isActive) {
            if(this.manager.dungeon.area !== undefined) {
                let floor = this.manager.dungeon.progress === this.manager.dungeon.numFloors ? "Boss Floor" : `Floor ${this.manager.dungeon.progress+1}`;
                status += `${this.manager.dungeon.area.name} - ${floor}`;
            }

            if(this.manager.encounter.isFighting)
                status += ` - Round ${this.manager.encounter.roundCounter}`;
        } else {
            status = `Town`;
        }

        this.component.statusText.textContent = status;

        this.renderQueue.status = false;
    }

    renderTurnProgress() {
        if(!this.renderQueue.turnProgressBar)
            return;

        if(this.component.turnProgressBar.currentStyle !== 'bg-warning')
            this.component.turnProgressBar.setStyle('bg-warning');

        if(this.manager.encounter.hitTimer.isActive) {
            this.component.turnProgressBar.animateStriped();
        } else if(this.manager.encounter.turnTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.encounter.turnTimer);
        } else if(this.manager.dungeon.exploreTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.dungeon.exploreTimer);
        } else if(this.manager.townTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.townTimer);
        } else {
            this.component.turnProgressBar.stopAnimation();
        }

        this.renderQueue.turnProgressBar = false;
    }

    renderBuffs() {
        if(!this.renderQueue.buffs)
            return;

        // Clear existing effects and destroy old tooltips
        while(this.component.effectsContainer.firstChild) {
            const child = this.component.effectsContainer.firstChild;
            if(child._tippy) child._tippy.destroy();
            this.component.effectsContainer.removeChild(child);
        }

        const effects = [];

        // 1. Current difficulty mode (only when in dungeon)
        if(this.manager.isActive) {
            const difficulty = this.manager.dungeon.area?.getDifficulty();
            if(difficulty) {
                effects.push({
                    name: difficulty.name,
                    media: difficulty.media,
                    tooltip: difficulty.tooltip,
                    colorClass: difficulty.color
                });
            }
        }

        // 2. Equipped consumables (non-tavern drinks) - always visible
        const equipped = this.manager.consumables.equipped;
        equipped.forEach(consumable => {
            if(consumable && !consumable.isTavernDrink) {
                effects.push({
                    name: consumable.name,
                    media: consumable.media,
                    tooltip: this.buildConsumableTooltip(consumable, false)
                });
            }
        });

        // 3. Active tavern drinks - always visible
        const tavernDrinks = this.manager.consumables.getActiveTavernDrinks();
        tavernDrinks.forEach(({ consumable, runsRemaining }) => {
            effects.push({
                name: consumable.name,
                media: consumable.media,
                tooltip: this.buildConsumableTooltip(consumable, true, runsRemaining)
            });
        });

        // 4. Active mastery auras - always visible
        this.manager.areas.allObjects.forEach(area => {
            if(area.masteryAuraUnlocked && area.masteryAura) {
                const aura = area.masteryAura;
                effects.push({
                    name: aura.name || `${area.name} Aura`,
                    media: aura.media || area.media,
                    tooltip: this.buildAuraTooltip(aura, area)
                });
            }
        });

        // Always show section (no d-none toggle)

        // Render effect icons
        effects.forEach(effect => {
            const icon = new AdventuringEffectIconElement();
            this.component.effectsContainer.appendChild(icon);
            icon.setEffect(effect);
        });

        this.renderQueue.buffs = false;
    }

    /**
     * Build tooltip HTML for a consumable buff
     */
    buildConsumableTooltip(consumable, isTavernDrink, runsRemaining = 0) {
        const lines = [];
        lines.push(`<div class="font-w700">${consumable.name}</div>`);
        lines.push(`<div class="text-muted font-size-sm">${consumable.type.charAt(0).toUpperCase() + consumable.type.slice(1)}</div>`);
        
        if(consumable.description) {
            lines.push(`<hr class="my-1">`);
            lines.push(`<div class="text-info">${consumable.description}</div>`);
        }
        
        // Show effects
        if(consumable.effects && consumable.effects.length > 0) {
            lines.push(`<hr class="my-1">`);
            consumable.effects.forEach(effect => {
                const desc = describeEffect(effect, this.manager);
                lines.push(`<div class="text-success">${desc}</div>`);
            });
        }
        
        // Show trigger type
        if(consumable.triggerType) {
            lines.push(`<hr class="my-1">`);
            const triggerText = consumable.triggerType === 'passive' ? 'Triggers automatically' : 'Activated when conditions met';
            lines.push(`<div class="text-muted font-size-sm">${triggerText}</div>`);
        }
        
        // Show charges/runs
        lines.push(`<hr class="my-1">`);
        if(isTavernDrink) {
            lines.push(`<div class="text-warning">${runsRemaining} run${runsRemaining !== 1 ? 's' : ''} remaining</div>`);
        } else {
            lines.push(`<div class="text-muted">Charges: ${consumable.charges}/${consumable.maxCharges}</div>`);
        }
        
        return lines.join('');
    }

    /**
     * Build tooltip HTML for a mastery aura
     */
    buildAuraTooltip(aura, area) {
        const lines = [];
        lines.push(`<div class="font-w700">${aura.name || area.name + ' Aura'}</div>`);
        lines.push(`<div class="text-muted font-size-sm">Mastery Aura</div>`);
        
        if(aura.description) {
            lines.push(`<hr class="my-1">`);
            lines.push(`<div class="text-info">${aura.description}</div>`);
        }
        
        lines.push(`<hr class="my-1">`);
        lines.push(`<div class="text-muted font-size-sm">Unlocked from ${area.name} Level 99</div>`);
        
        return lines.join('');
    }
}