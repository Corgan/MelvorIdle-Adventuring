
export class AdventuringBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-badge-template'));

        this.badge = getElementFromFragment(this._content, 'badge', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    setBadge({ text, type = 'secondary', size = 'normal', icon }) {
        const sizeClass = size === 'xs' ? 'font-size-xs' : size === 'sm' ? 'font-size-sm' : '';
        this.badge.className = `badge badge-${type} mr-1 ${sizeClass}`.trim();

        if(icon) {
            this.badge.innerHTML = `<i class="fa ${icon} mr-1"></i>${text}`;
        } else {
            this.badge.textContent = text;
        }
    }

    setTier(tier) {
        const colors = {
            1: 'secondary',
            2: 'success',
            3: 'info',
            4: 'warning'
        };
        this.setBadge({
            text: `Tier ${tier}`,
            type: colors[tier] || 'secondary',
            size: 'sm'
        });
    }

    setLocation(name) {
        this.setBadge({
            text: name,
            type: 'info'
        });
    }

    reset() {
        this.badge.className = 'badge badge-secondary mr-1';
        this.badge.textContent = '';
        this.badge.innerHTML = '';
    }
}
window.customElements.define('adventuring-badge', AdventuringBadgeElement);
