/**
 * Job icon element - compact job reference with icon and name
 * Used in tooltips, ability sources, job requirements
 */
export class AdventuringJobIconElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-job-icon-template'));
        
        this.container = getElementFromFragment(this._content, 'container', 'span');
        this.icon = getElementFromFragment(this._content, 'icon', 'img');
        this.nameText = getElementFromFragment(this._content, 'name', 'span');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the job to display
     * @param {Object} job - Job object with media and name properties
     */
    setJob(job) {
        this.icon.src = job.media;
        this.nameText.textContent = job.name;
    }

    /**
     * Set job with level requirement
     * @param {Object} job - Job object with media and name properties
     * @param {number} level - Level requirement
     */
    setJobWithLevel(job, level) {
        this.icon.src = job.media;
        this.nameText.textContent = `${job.name} Lv.${level}`;
    }

    /**
     * Set icon and name directly
     * @param {string} iconSrc - Icon URL
     * @param {string} name - Display name
     */
    set(iconSrc, name) {
        this.icon.src = iconSrc;
        this.nameText.textContent = name;
    }
}
window.customElements.define('adventuring-job-icon', AdventuringJobIconElement);
