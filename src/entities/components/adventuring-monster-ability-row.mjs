const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

export class AdventuringMonsterAbilityRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-monster-ability-row-template'));

        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.typeLabel = getElementFromFragment(this._content, 'type-label', 'span');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');

        this._tooltipTarget = this.row;
        this._tooltipOptions = { placement: 'right' };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    setAbility({ type, name, tooltipContent }) {
        const typeLabels = { generator: 'Generator:', spender: 'Spender:', passive: 'Passive:' };

        this.typeLabel.textContent = typeLabels[type] || type;
        this.nameText.textContent = name;
        const typeColors = { generator: 'text-success', spender: 'text-warning', passive: 'text-info' };
        this.nameText.className = `ml-auto ${typeColors[type] || ''}`;

        this.setTooltipContent(tooltipContent);
    }

    reset() {
        this.typeLabel.textContent = '';
        this.nameText.textContent = '';
        this.nameText.className = 'ml-auto';
        this.setTooltipContent('');
    }
}
window.customElements.define('adventuring-monster-ability-row', AdventuringMonsterAbilityRowElement);
