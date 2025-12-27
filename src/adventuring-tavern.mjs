const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringTavernElement } = await loadModule('src/components/adventuring-tavern.mjs');
const { TooltipBuilder } = await loadModule('src/adventuring-tooltip.mjs');

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
            const empty = document.createElement('div');
            empty.className = 'text-center text-muted p-2';
            empty.textContent = 'No active drinks. Buy one to gain buffs!';
            this.component.activeBuffs.appendChild(empty);
        } else {
            activeDrinks.forEach(({ consumable, runsRemaining }) => {
                const badge = document.createElement('div');
                badge.className = 'badge badge-info m-1 p-2';
                badge.innerHTML = `<img class="skill-icon-xxs mr-1" src="${consumable.media}">${consumable.name} (${runsRemaining} runs)`;
                this.component.activeBuffs.appendChild(badge);
            });
        }

        this.renderQueue.activeBuffs = false;
        this.renderQueue.all = false;
    }

    createDrinkCard(drink) {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 p-2';

        const card = document.createElement('div');
        card.className = 'block block-rounded-double bg-combat-inner-dark p-3';

        // Tier badge
        const tierColors = ['secondary', 'info', 'warning'];
        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const tierBadge = document.createElement('span');
        tierBadge.className = `badge badge-${tierColors[drink.tier - 1] || 'secondary'}`;
        tierBadge.textContent = `Tier ${drink.tier}`;
        header.appendChild(tierBadge);

        const duration = document.createElement('small');
        duration.className = 'text-muted';
        duration.textContent = `${drink.duration} runs`;
        header.appendChild(duration);

        card.appendChild(header);

        // Drink info
        const info = document.createElement('div');
        info.className = 'd-flex align-items-center mb-2';
        
        const icon = document.createElement('img');
        icon.className = 'skill-icon-sm mr-2';
        icon.src = drink.media;
        info.appendChild(icon);

        const nameDesc = document.createElement('div');
        nameDesc.innerHTML = `<strong class="text-white">${drink.name}</strong><br><small class="text-muted">${drink.description}</small>`;
        info.appendChild(nameDesc);

        card.appendChild(info);

        // Effects
        const effects = document.createElement('div');
        effects.className = 'small text-success mb-2';
        effects.textContent = drink.effectText;
        card.appendChild(effects);

        // Cost - styled like armory
        const costSection = document.createElement('div');
        costSection.className = 'mb-2';
        
        const costLabel = document.createElement('h6');
        costLabel.className = 'font-w700 text-combat-smoke text-center m-0 mb-1';
        costLabel.textContent = 'Cost';
        costSection.appendChild(costLabel);
        
        const costItems = document.createElement('div');
        costItems.className = 'row no-gutters justify-content-center';
        
        if(drink.cost && drink.cost.length > 0) {
            for(const c of drink.cost) {
                const mat = this.manager.materials.getObjectByID(c.id);
                if(mat) {
                    const component = createElement('adventuring-material');
                    component.mount(costItems);
                    const owned = mat.count;
                    component.setTooltipContent(TooltipBuilder.forMaterial(mat).build());
                    component.icon.src = mat.media;
                    component.count.textContent = c.qty;
                    // Border based on affordability
                    if(owned >= c.qty) {
                        component.border.classList.remove('border-danger');
                        component.border.classList.add('border-success');
                    } else {
                        component.border.classList.remove('border-success');
                        component.border.classList.add('border-danger');
                    }
                }
            }
        }
        costSection.appendChild(costItems);
        card.appendChild(costSection);

        // Buy button
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-block';
        
        if(drink.canAfford()) {
            btn.className += ' btn-primary';
            btn.textContent = 'Buy';
            btn.onclick = () => {
                if(drink.purchase()) {
                    this.renderQueue.all = true;
                    this.render();
                }
            };
        } else {
            btn.className += ' btn-secondary';
            btn.textContent = 'Cannot Afford';
            btn.disabled = true;
        }
        card.appendChild(btn);

        col.appendChild(card);
        return col;
    }

    // Encoding/decoding handled by AdventuringConsumables (tavern drinks use charges)
    encode(writer) {
        // Nothing to encode - tavern drinks stored in consumables.charges
    }

    decode(reader, version) {
        // Nothing to decode - tavern drinks stored in consumables.charges
    }
}