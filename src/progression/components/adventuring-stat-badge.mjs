const { loadModule } = mod.getContext(import.meta);

const { AdventuringStatBreakdownTooltipElement } = await loadModule('src/ui/components/adventuring-stat-breakdown-tooltip.mjs');

export class AdventuringStatBadgeElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-badge-template'));

        this.col = getElementFromFragment(this._content, 'col', 'div');
        this.content = getElementFromFragment(this._content, 'content', 'div');
        this.iconEl = getElementFromFragment(this._content, 'icon', 'i');
        this.imgEl = null; // Created on demand for image-based icons
        this.valueEl = getElementFromFragment(this._content, 'value', 'span');
        this.labelEl = getElementFromFragment(this._content, 'label', 'small');

        this._tooltip = null;
        this._breakdownTooltip = null;
        this._stat = null;
        this._character = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    disconnectedCallback() {
        this.clearTooltip();
    }

    setTooltipContent(content) {
        this.clearTooltip();
        if(!content) return;

        this._tooltip = tippy(this.content, {
            content,
            placement: 'top',
            allowHTML: true,
            interactive: false,
            animation: false
        });
    }
    
    /**
     * Set up interactive breakdown tooltip for a character's stat
     * @param {Object} stat - The stat object
     * @param {Object} character - The character with statBreakdownCache
     */
    setBreakdownTooltip(stat, character) {
        this.clearTooltip();
        
        this._stat = stat;
        this._character = character;
        
        if (!character || !character.statBreakdownCache) {
            // Fallback to simple tooltip
            this._tooltip = tippy(this.content, {
                content: `<span class="text-info">${stat.name}</span>`,
                placement: 'top',
                allowHTML: true,
                interactive: false,
                animation: false
            });
            return;
        }

        // Create breakdown tooltip element
        const breakdownEl = new AdventuringStatBreakdownTooltipElement();
        
        this._breakdownTooltip = tippy(this.content, {
            content: breakdownEl,
            placement: 'right',
            allowHTML: true,
            interactive: true,
            animation: false,
            trigger: 'mouseenter click',
            hideOnClick: false,
            maxWidth: 450,
            appendTo: document.body,
            onShow: () => {
                // Rebuild breakdown on show to get latest values
                if (this._character && this._character.statBreakdownCache && this._stat) {
                    const breakdown = this._character.statBreakdownCache.getBreakdown(this._stat);
                    if (breakdown) {
                        breakdownEl.setBreakdown(breakdown);
                    }
                }
            }
        });
    }

    clearTooltip() {
        if(this._tooltip) {
            this._tooltip.destroy();
            this._tooltip = null;
        }
        if(this._breakdownTooltip) {
            this._breakdownTooltip.destroy();
            this._breakdownTooltip = null;
        }
    }

    setStatData(icon, colorClass, value, label) {
        this.content.className = colorClass || '';
        this.iconEl.className = `fa ${icon} mr-1`;
        this.iconEl.classList.remove('d-none');
        if(this.imgEl) this.imgEl.classList.add('d-none');
        this.valueEl.textContent = `+${value}`;
        this.labelEl.textContent = label;
    }

    setStatDataFromStat(stat, value, showPrefix = true) {

        this.iconEl.classList.add('d-none');

        if(!this.imgEl) {
            this.imgEl = document.createElement('img');
            this.imgEl.className = 'skill-icon-xxs mr-1';
            this.iconEl.parentNode.insertBefore(this.imgEl, this.iconEl);
        }
        this.imgEl.classList.remove('d-none');
        this.imgEl.src = stat.media;

        this.content.className = '';
        this.valueEl.textContent = showPrefix ? `+${value}` : `${value}`;
        this.labelEl.textContent = stat.name;
        this.labelEl.classList.remove('d-none');
        this.clearTooltip();
    }

    setStatCompact(stat, value, small = false, character = null) {

        this.iconEl.classList.add('d-none');

        if(!this.imgEl) {
            this.imgEl = document.createElement('img');
            this.imgEl.className = 'skill-icon-xxs';
            this.iconEl.parentNode.insertBefore(this.imgEl, this.iconEl);
        }
        this.imgEl.classList.remove('d-none');
        this.imgEl.src = stat.media;

        this.col.className = 'col-4 mb-1';
        this.content.className = 'd-flex flex-column align-items-center';

        if(small) {
            this.imgEl.className = 'mb-1';
            this.imgEl.style.width = '16px';
            this.imgEl.style.height = '16px';
        } else {
            this.imgEl.className = 'skill-icon-xs mb-1';
            this.imgEl.style.width = '';
            this.imgEl.style.height = '';
        }

        this.valueEl.className = 'font-w600 text-white';
        this.valueEl.textContent = `${value}`;

        this.labelEl.classList.add('d-none');
        
        // Use breakdown tooltip if character provided, otherwise simple tooltip
        if (character && character.statBreakdownCache) {
            this.setBreakdownTooltip(stat, character);
        } else {
            this.setTooltipContent(`<span class="text-info">${stat.name}</span>`);
        }
    }

    reset() {
        this.col.className = 'col-12 p-2';
        this.content.className = '';
        this.iconEl.className = 'fa mr-1';
        this.iconEl.classList.remove('d-none');
        if(this.imgEl) {
            this.imgEl.classList.add('d-none');
            this.imgEl.className = 'skill-icon-xxs mr-1';
            this.imgEl.style.width = '';
            this.imgEl.style.height = '';
        }
        this.valueEl.className = 'font-w600';
        this.valueEl.textContent = '';
        this.labelEl.textContent = '';
        this.labelEl.classList.remove('d-none');
        this.clearTooltip();
        this._stat = null;
        this._character = null;
    }
}
window.customElements.define('adventuring-stat-badge', AdventuringStatBadgeElement);