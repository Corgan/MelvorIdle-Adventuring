const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringLootRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-loot-row-template'));

        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.typeBadge = getElementFromFragment(this._content, 'typeBadge', 'span');
        this.qty = getElementFromFragment(this._content, 'qty', 'small');
        this.chance = getElementFromFragment(this._content, 'chance', 'small');

        this._tooltipTarget = this.row;
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setLoot({ icon, name, type, qty, chance, tooltipContent, nested = false, isHeader = false, collected = false }) {
        this.icon.src = icon || '';
        this.nameText.textContent = name;
        if(isHeader) {
            this.icon.classList.add('d-none');
            this.row.style.marginLeft = '';
            this.nameText.className = 'font-w600';
        } else if(nested) {
            this.icon.classList.remove('d-none');
            this.row.style.marginLeft = '24px';
            this.nameText.className = collected ? 'text-success' : 'text-muted';
        } else {
            this.icon.classList.remove('d-none');
            this.icon.style.visibility = icon ? 'visible' : 'hidden';
            this.row.style.marginLeft = '';
            this.nameText.className = 'font-w600';
        }
        const badgeColors = {
            currency: 'badge-warning',
            salvage: 'badge-secondary',
            materials: 'badge-info',
            equipment: 'badge-success'
        };
        this.typeBadge.className = `badge ml-auto ${badgeColors[type] || 'badge-dark'}`;
        this.typeBadge.textContent = type;
        this.typeBadge.classList.toggle('d-none', nested);

        this.qty.textContent = qty;
        this.chance.textContent = chance;

        if(tooltipContent) {
            this.setTooltipContent(tooltipContent);
        }
    }

    reset() {
        this.icon.src = '';
        this.icon.style.visibility = '';
        this.icon.classList.remove('d-none');
        this.nameText.textContent = '';
        this.nameText.className = 'font-w600';
        this.row.style.marginLeft = '';
        this.typeBadge.textContent = '';
        this.typeBadge.className = 'badge mr-3';
        this.qty.textContent = '';
        this.chance.textContent = '';
        this.clearTooltip();
    }
}
window.customElements.define('adventuring-loot-row', AdventuringLootRowElement);
