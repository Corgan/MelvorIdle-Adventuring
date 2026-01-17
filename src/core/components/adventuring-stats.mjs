const { loadModule } = mod.getContext(import.meta);

const { AdventuringStatBadgeElement } = await loadModule('src/progression/components/adventuring-stat-badge.mjs');

export class AdventuringStatsElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stats-template'));

        this.stats = getElementFromFragment(this._content, 'stats', 'div');
        this.statsMap = new Map();
        
        // Reference to owning character (for breakdown tooltips)
        this.character = null;
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }
    
    /**
     * Set the character owner for breakdown tooltips
     * @param {AdventuringCharacter} character
     */
    setCharacter(character) {
        this.character = character;
    }

    update(stat, value) {
        if(typeof stat === "string")
            stat = this.skill.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component === undefined) {
            component = new AdventuringStatBadgeElement();
            this.stats.appendChild(component);
            this.statsMap.set(stat, component);
        }
        if(value !== 0 || stat.base !== undefined) {
            showElement(component);
            component.setStatCompact(stat, value !== 0 ? value : "-", true, this.character);
        } else {
            hideElement(component);
        }
    }

    delete(stat) {
        if(typeof stat === "string")
            stat = this.skill.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component !== undefined) {
            hideElement(component);
        }
    }
}
window.customElements.define('adventuring-stats', AdventuringStatsElement);