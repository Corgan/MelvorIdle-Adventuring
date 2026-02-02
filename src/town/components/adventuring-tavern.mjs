const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');
const { createTooltip } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { AdventuringIconButtonElement } = await loadModule('src/ui/components/adventuring-icon-button.mjs');

export class AdventuringTavernElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-tavern-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.drinks = getElementFromFragment(this._content, 'drinks', 'div');
        this.slots = [];
        for (let i = 0; i < 3; i++) {
            this.slots.push(getElementFromFragment(this._content, `slot-${i}`, 'div'));
        }
        this.detailsContainer = getElementFromFragment(this._content, 'details-container', 'div');
        this.details = getElementFromFragment(this._content, 'details', 'div');
        this.detailsPlaceholder = getElementFromFragment(this._content, 'details-placeholder', 'div');
        this.detailIcon = getElementFromFragment(this._content, 'detail-icon', 'img');
        this.detailName = getElementFromFragment(this._content, 'detail-name', 'h5');
        this.detailDescription = getElementFromFragment(this._content, 'detail-description', 'p');
        this.detailEffects = getElementFromFragment(this._content, 'detail-effects', 'div');
        this.detailMaterials = getElementFromFragment(this._content, 'detail-materials', 'div');
        this.detailCharges = getElementFromFragment(this._content, 'detail-charges', 'span');
        this.craftButton = getElementFromFragment(this._content, 'craft-button', 'button');
        this.equipButton = getElementFromFragment(this._content, 'equip-button', 'button');
        this.tierButtons = getElementFromFragment(this._content, 'tier-buttons', 'div');
        this.tierButtonElements = [];
        for (let i = 1; i <= 4; i++) {
            this.tierButtonElements.push(getElementFromFragment(this._content, `tier-${i}`, 'button'));
        }
        this.drinkIcons = new Map();
    }

    showDetails() {
        this.details.classList.remove('d-none');
        this.detailsPlaceholder.classList.add('d-none');
    }

    hideDetails() {
        this.details.classList.add('d-none');
        this.detailsPlaceholder.classList.remove('d-none');
    }

    renderDrinkGrid(drinks, selectedDrink, onSelect, manager) {
        this.drinks.replaceChildren();
        this.drinkIcons.clear();

        for (const drink of drinks) {
            const icon = this.createDrinkIcon(drink, drink === selectedDrink, () => onSelect(drink), manager);
            this.drinks.appendChild(icon);
            this.drinkIcons.set(drink, icon);
        }
    }

    createDrinkIcon(drink, isSelected, onClick, manager) {
        const totalCharges = drink.totalCharges;
        const tooltipContent = TooltipBuilder.forTavernDrink(drink, totalCharges).build();

        const iconBtn = new AdventuringIconButtonElement();
        iconBtn.setIcon({
            icon: drink.media,
            borderClass: isSelected ? 'border-info' : 'border-secondary',
            cornerBadgeText: drink.isEquipped ? 'E' : undefined,
            cornerBadgeClass: 'badge-success',
            bottomBadgeText: totalCharges > 0 ? totalCharges : undefined,
            bottomBadgeClass: 'bg-info',
            tooltipContent,
            onClick
        });

        return iconBtn;
    }

    renderEquippedSlots(activeDrinks, maxSlots, onUnequip) {
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            const active = activeDrinks[i];

            slot.replaceChildren();

            if (active) {
                const iconBtn = new AdventuringIconButtonElement();
                iconBtn.setIcon({
                    icon: active.drink.getTierMedia(active.tier),
                    borderClass: 'border-success',
                    bottomBadgeText: active.runsRemaining,
                    bottomBadgeClass: 'bg-success',
                    tooltipContent: `${active.drink.getTierName(active.tier)} (${active.runsRemaining} runs) - Click to unequip`,
                    onClick: () => onUnequip(active.drink)
                });
                iconBtn.container.classList.remove('m-1');
                slot.appendChild(iconBtn);
                slot.classList.remove('border-secondary');
                slot.classList.add('border-success');
                slot.style.borderStyle = 'solid!important';
            } else {
                const img = document.createElement('img');
                img.className = 'w-100 p-1 invisible';
                slot.appendChild(img);
                slot.classList.remove('border-success');
                slot.classList.add('border-secondary');
                slot.style.borderStyle = 'dashed!important';
                slot.onclick = null;
                slot.title = 'Empty slot';
            }
        }
    }

    renderDetails({ drink, tier, charges, equippedTier, canAfford, onSelectTier, onCraft, onEquip }) {
        this.showDetails();
        this.detailIcon.src = drink.getTierMedia(tier);
        this.detailName.textContent = drink.getTierName(tier);
        this.detailDescription.innerHTML = drink.getTierDescription(tier);
        for (let i = 0; i < 4; i++) {
            const btn = this.tierButtonElements[i];
            const t = i + 1;
            btn.classList.toggle('active', t === tier);
            btn.classList.toggle('btn-info', t === tier);
            btn.classList.toggle('btn-outline-info', t !== tier);
            const tierCharges = drink.getCharges(t);
            btn.textContent = ['I', 'II', 'III', 'IV'][i];
            if (tierCharges > 0) {
                btn.textContent += ` (${tierCharges})`;
            }

            btn.onclick = () => onSelectTier(t);
        }
        const materials = drink.getTierMaterials(tier);
        this.detailMaterials.replaceChildren();
        if (materials.size > 0) {
            const container = document.createElement('div');
            container.className = 'd-flex flex-wrap align-items-center justify-content-center';
            for (const [mat, qty] of materials) {
                const owned = mat.count || 0;
                const component = document.createElement('adventuring-material');
                container.appendChild(component);
                component.icon.src = mat.media;
                component.count.textContent = qty;
                if (owned >= qty) {
                    component.border.classList.remove('border-danger');
                    component.border.classList.add('border-success');
                } else {
                    component.border.classList.remove('border-success');
                    component.border.classList.add('border-danger');
                }
                const tooltipContent = TooltipBuilder.create()
                    .header(mat.name, mat.media)
                    .text(`Owned: ${owned}`, owned >= qty ? 'text-success' : 'text-danger')
                    .build();
                component.setTooltipContent(tooltipContent);
            }
            this.detailMaterials.appendChild(container);
        } else {
            this.detailMaterials.innerHTML = '<span class="text-muted">None</span>';
        }
        this.detailCharges.textContent = charges;
        this.craftButton.disabled = !canAfford;
        this.craftButton.classList.toggle('btn-info', canAfford);
        this.craftButton.classList.toggle('btn-secondary', !canAfford);
        this.craftButton.onclick = onCraft;
        const isThisTierEquipped = equippedTier === tier;
        const hasCharges = charges > 0;

        if (isThisTierEquipped) {
            this.equipButton.textContent = 'Unequip';
            this.equipButton.classList.remove('btn-success', 'btn-secondary');
            this.equipButton.classList.add('btn-danger');
            this.equipButton.disabled = false;
        } else if (hasCharges) {
            this.equipButton.textContent = 'Equip';
            this.equipButton.classList.remove('btn-danger', 'btn-secondary');
            this.equipButton.classList.add('btn-success');
            this.equipButton.disabled = false;
        } else {
            this.equipButton.textContent = 'Equip';
            this.equipButton.classList.remove('btn-success', 'btn-danger');
            this.equipButton.classList.add('btn-secondary');
            this.equipButton.disabled = true;
        }

        this.equipButton.onclick = onEquip;
    }

    renderEmptyDetails() {
        this.hideDetails();
    }
}
window.customElements.define('adventuring-tavern', AdventuringTavernElement);
