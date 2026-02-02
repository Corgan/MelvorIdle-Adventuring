const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/components/adventuring-tooltip-element.mjs');

export class AdventuringAbilityRowElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-ability-row-template'));

        this.row = getElementFromFragment(this._content, 'row', 'div');
        this.status = getElementFromFragment(this._content, 'status', 'span');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
        this.badge = getElementFromFragment(this._content, 'badge', 'span');
        this.level = getElementFromFragment(this._content, 'level', 'small');

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

    setAbility({ name, isUnlocked, type, unlockLevel, tooltipContent }) {
        this.status.className = isUnlocked
            ? 'fas fa-check text-success mr-2'
            : 'fas fa-lock text-warning mr-2';
        this.status.textContent = '';
        this.nameText.className = isUnlocked ? 'font-w600' : 'font-w600 text-muted';
        this.nameText.textContent = name;
        const badgeColors = { generator: 'badge-info', spender: 'badge-warning', passive: 'badge-success' };
        const badgeLabels = { generator: 'Generator', spender: 'Spender', passive: 'Passive' };
        this.badge.className = `badge ${badgeColors[type]} ml-auto`;
        this.badge.textContent = badgeLabels[type];
        this.level.textContent = `Lv.${unlockLevel}`;

        this.setTooltipContent(tooltipContent);
    }
}
window.customElements.define('adventuring-ability-row', AdventuringAbilityRowElement);
