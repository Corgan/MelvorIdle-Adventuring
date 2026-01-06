const { loadModule } = mod.getContext(import.meta);

const { AdventuringSubpageElement } = await loadModule('src/ui/components/adventuring-page.mjs');
const { createTooltip } = await loadModule('src/core/adventuring-tooltip-element.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

export class AdventuringTavernElement extends AdventuringSubpageElement {
    constructor() {
        super('adventuring-tavern-template');

        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.drinks = getElementFromFragment(this._content, 'drinks', 'div');
        
        // Equipment slots
        this.slots = [];
        for (let i = 0; i < 3; i++) {
            this.slots.push(getElementFromFragment(this._content, `slot-${i}`, 'div'));
        }
        
        // Details panel
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
        
        // Tier buttons
        this.tierButtons = getElementFromFragment(this._content, 'tier-buttons', 'div');
        this.tierButtonElements = [];
        for (let i = 1; i <= 4; i++) {
            this.tierButtonElements.push(getElementFromFragment(this._content, `tier-${i}`, 'button'));
        }
        
        // Track drink icon elements for selection styling
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

    /**
     * Render the drink grid (icon list)
     */
    renderDrinkGrid(drinks, selectedDrink, onSelect, manager) {
        this.drinks.replaceChildren();
        this.drinkIcons.clear();
        
        for (const drink of drinks) {
            const icon = this.createDrinkIcon(drink, drink === selectedDrink, () => onSelect(drink), manager);
            this.drinks.appendChild(icon);
            this.drinkIcons.set(drink, icon);
        }
    }

    /**
     * Create a drink icon element
     */
    createDrinkIcon(drink, isSelected, onClick, manager) {
        const container = document.createElement('div');
        container.className = 'pointer-enabled m-1';
        container.style.position = 'relative';
        container.style.width = 'fit-content';
        
        const border = document.createElement('div');
        border.className = `border-2x border-rounded-equip combat-equip-img fishing-img m-0 ${isSelected ? 'border-info' : 'border-secondary'}`;
        border.style.cssText = 'position: relative; overflow: hidden; border-width: 2px!important; border-style: solid!important;';
        
        const img = document.createElement('img');
        img.className = 'w-100 p-1';
        img.src = drink.media;
        
        border.appendChild(img);
        container.appendChild(border);
        
        // Show total charges badge
        const totalCharges = drink.totalCharges;
        if (totalCharges > 0) {
            const badge = document.createElement('div');
            badge.className = 'font-size-sm text-white text-center';
            badge.style.cssText = 'position: absolute; bottom: -8px; width: 100%;';
            badge.innerHTML = `<small class="badge-pill bg-info">${totalCharges}</small>`;
            container.appendChild(badge);
        }
        
        // Show equipped indicator
        if (drink.isEquipped) {
            const equipped = document.createElement('span');
            equipped.className = 'badge badge-success';
            equipped.style.cssText = 'position: absolute; top: 2px; right: 2px; font-size: 0.5rem; z-index: 10;';
            equipped.textContent = 'E';
            border.appendChild(equipped);
        }
        
        // Add tooltip with effects and description
        const tooltipContent = TooltipBuilder.forTavernDrink(drink, drink.totalCharges).build();
        createTooltip(container, tooltipContent, { hideOnClick: true });
        
        container.onclick = onClick;
        return container;
    }

    /**
     * Render the equipped slots at the top
     */
    renderEquippedSlots(activeDrinks, maxSlots, onUnequip) {
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            const active = activeDrinks[i];
            
            slot.replaceChildren();
            
            const img = document.createElement('img');
            img.className = 'w-100 p-1';
            
            if (active) {
                img.src = active.drink.getTierMedia(active.tier);
                slot.classList.remove('border-secondary');
                slot.classList.add('border-success');
                slot.style.borderStyle = 'solid!important';
                slot.onclick = () => onUnequip(active.drink);
                slot.title = `${active.drink.getTierName(active.tier)} (${active.runsRemaining} runs) - Click to unequip`;
                
                // Add charges badge
                const badge = document.createElement('div');
                badge.className = 'font-size-sm text-white text-center';
                badge.style.cssText = 'position: absolute; bottom: -8px; width: 100%;';
                badge.innerHTML = `<small class="badge-pill bg-success">${active.runsRemaining}</small>`;
                slot.appendChild(badge);
            } else {
                img.classList.add('invisible');
                slot.classList.remove('border-success');
                slot.classList.add('border-secondary');
                slot.style.borderStyle = 'dashed!important';
                slot.onclick = null;
                slot.title = 'Empty slot';
            }
            
            slot.insertBefore(img, slot.firstChild);
        }
    }

    /**
     * Render the details panel for a selected drink
     */
    renderDetails({ drink, tier, charges, equippedTier, canAfford, onSelectTier, onCraft, onEquip }) {
        this.showDetails();
        
        // Icon and name
        this.detailIcon.src = drink.getTierMedia(tier);
        this.detailName.textContent = drink.getTierName(tier);
        this.detailDescription.textContent = drink.getTierDescription(tier);
        
        // Tier buttons
        for (let i = 0; i < 4; i++) {
            const btn = this.tierButtonElements[i];
            const t = i + 1;
            btn.classList.toggle('active', t === tier);
            btn.classList.toggle('btn-info', t === tier);
            btn.classList.toggle('btn-outline-info', t !== tier);
            
            // Show charge count on tier button
            const tierCharges = drink.getCharges(t);
            btn.textContent = ['I', 'II', 'III', 'IV'][i];
            if (tierCharges > 0) {
                btn.textContent += ` (${tierCharges})`;
            }
            
            btn.onclick = () => onSelectTier(t);
        }
        
        // Materials - use adventuring-material components like armory
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
                // Border based on affordability
                if (owned >= qty) {
                    component.border.classList.remove('border-danger');
                    component.border.classList.add('border-success');
                } else {
                    component.border.classList.remove('border-success');
                    component.border.classList.add('border-danger');
                }
                // Set tooltip content using the component's built-in tooltip
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
        
        // Charges
        this.detailCharges.textContent = charges;
        
        // Craft button
        this.craftButton.disabled = !canAfford;
        this.craftButton.classList.toggle('btn-info', canAfford);
        this.craftButton.classList.toggle('btn-secondary', !canAfford);
        this.craftButton.onclick = onCraft;
        
        // Equip button
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

    /**
     * Render empty details placeholder
     */
    renderEmptyDetails() {
        this.hideDetails();
    }
}
window.customElements.define('adventuring-tavern', AdventuringTavernElement);
