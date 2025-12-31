const { loadModule } = mod.getContext(import.meta);

const { AdventuringTooltipElement } = await loadModule('src/core/adventuring-tooltip-element.mjs');

/**
 * Job selector button for job picker popup
 */
export class AdventuringJobSelectorBtnElement extends AdventuringTooltipElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-selector-btn-template'));
        
        this.wrapper = getElementFromFragment(this._content, 'wrapper', 'div');
        this.btn = getElementFromFragment(this._content, 'btn', 'div');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'small');
        this.level = getElementFromFragment(this._content, 'level', 'small');
        
        this.onSelect = null;
        this._tooltipTarget = this.btn;
        this._tooltipOptions = { placement: 'top', delay: [200, 0] };
    }

    connectedCallback() {
        this.appendChild(this._content);
        super.connectedCallback();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.onSelect = null;
    }

    /**
     * Set the job to display
     * @param {Object} options - Configuration options
     * @param {Object} options.job - Job object
     * @param {number} options.masteryLevel - Current mastery level
     * @param {boolean} options.isSelected - Whether this job is currently selected
     * @param {string} options.tooltipContent - HTML content for tooltip
     * @param {Function} options.onSelect - Callback when button is clicked
     */
    setJob({ job, masteryLevel, isSelected, tooltipContent, onSelect }) {
        this.icon.src = job.media;
        this.nameText.textContent = job.name;
        this.level.textContent = `Lv.${masteryLevel}`;
        this.onSelect = onSelect;
        
        // Selection styling
        if (isSelected) {
            this.btn.classList.remove('bg-combat-inner-dark');
            this.btn.classList.add('adventuring-selected');
        } else {
            this.btn.classList.remove('adventuring-selected');
            this.btn.classList.add('bg-combat-inner-dark');
        }
        
        // Click handler
        this.btn.onclick = (e) => {
            e.stopPropagation();
            if (this.onSelect) {
                this.onSelect(job);
            }
        };
        
        this.setTooltipContent(tooltipContent);
    }
}
window.customElements.define('adventuring-job-selector-btn', AdventuringJobSelectorBtnElement);
