const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringTavernElement } = await loadModule('src/town/components/adventuring-tavern.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringDrinkCardElement } = await loadModule('src/town/components/adventuring-drink-card.mjs');
const { AdventuringActiveBuffBadgeElement } = await loadModule('src/town/components/adventuring-active-buff-badge.mjs');
const { AdventuringEmptyStateElement } = await loadModule('src/ui/components/adventuring-empty-state.mjs');

class TavernRenderQueue {
    constructor() {
        this.drinks = false;
        this.activeBuffs = false;
        this.all = false;
    }
}

export class AdventuringTavern extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-tavern');
        this.renderQueue = new TavernRenderQueue();

        // Drinks available for purchase (consumables with source: 'tavern')
        this.drinks = [];

        this.component.back.onclick = () => this.back();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
        this.initializeDrinks();
    }

    /**
     * Initialize the drink menu from consumables registry
     */
    initializeDrinks() {
        // Filter consumables to only show tavern drinks
        this.drinks = this.manager.consumableTypes.allObjects.filter(c => c.isTavernDrink);
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
        this.renderQueue.all = true;
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    postDataRegistration() {
        // Nothing special needed
    }

    /**
     * Get active tavern drinks from the consumables manager
     */
    get activeBuffs() {
        return this.manager.consumables.getActiveTavernDrinks();
    }

    /**
     * Get total stat bonuses from active drinks
     */
    getStatBonuses() {
        return this.manager.consumables.getTavernStatBonuses();
    }

    /**
     * Apply drink bonuses to a character's stats
     * @deprecated Bonuses are now queried in getEffectiveStat() instead of modifying base stats
     */
    applyBonuses(character) {
        // No longer used - tavern bonuses are now applied in character.getEffectiveStat()
        console.warn('AdventuringTavern.applyBonuses() is deprecated. Bonuses are now queried in getEffectiveStat()');
    }

    render() {
        this.renderDrinks();
        this.renderActiveBuffs();
    }

    renderDrinks() {
        if(!this.renderQueue.drinks && !this.renderQueue.all)
            return;

        this.component.drinks.replaceChildren();

        this.drinks.forEach(drink => {
            const card = this.createDrinkCard(drink);
            this.component.drinks.appendChild(card);
        });

        this.renderQueue.drinks = false;
    }

    renderActiveBuffs() {
        if(!this.renderQueue.activeBuffs && !this.renderQueue.all)
            return;

        this.component.activeBuffs.replaceChildren();
        
        const activeDrinks = this.activeBuffs;

        if(activeDrinks.length === 0) {
            const empty = new AdventuringEmptyStateElement();
            empty.setMessage('No active drinks. Buy one to gain buffs!', 'p-2');
            this.component.activeBuffs.appendChild(empty);
        } else {
            activeDrinks.forEach(({ consumable, runsRemaining }) => {
                const badge = new AdventuringActiveBuffBadgeElement();
                this.component.activeBuffs.appendChild(badge);
                badge.setBuff({
                    iconSrc: consumable.media,
                    name: consumable.name,
                    remaining: runsRemaining
                });
            });
        }

        this.renderQueue.activeBuffs = false;
        this.renderQueue.all = false;
    }

    createDrinkCard(drink) {
        const card = new AdventuringDrinkCardElement();
        
        card.setDrink({
            drink,
            canAfford: drink.canAfford(),
            onBuy: (d) => {
                if (d.purchase()) {
                    this.renderQueue.all = true;
                    this.render();
                }
            },
            renderCosts: (container, d) => {
                if (d.cost && d.cost.length > 0) {
                    for (const c of d.cost) {
                        const mat = this.manager.materials.getObjectByID(c.id);
                        if (mat) {
                            const component = createElement('adventuring-material');
                            component.mount(container);
                            const owned = mat.count;
                            component.setTooltipContent(TooltipBuilder.forMaterial(mat, this.manager).build());
                            component.icon.src = mat.media;
                            component.count.textContent = c.qty;
                            // Border based on affordability
                            if (owned >= c.qty) {
                                component.border.classList.remove('border-danger');
                                component.border.classList.add('border-success');
                            } else {
                                component.border.classList.remove('border-success');
                                component.border.classList.add('border-danger');
                            }
                        }
                    }
                }
            }
        });
        
        return card;
    }

    // Encoding/decoding handled by AdventuringConsumables (tavern drinks use charges)
    encode(writer) {
        // Nothing to encode - tavern drinks stored in consumables.charges
    }

    decode(reader, version) {
        // Nothing to decode - tavern drinks stored in consumables.charges
    }
}