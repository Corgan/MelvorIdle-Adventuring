const { loadModule } = mod.getContext(import.meta);

const { AdventuringStatElement } = await loadModule('src/components/adventuring-stat.mjs');

export class AdventuringStatsElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stats-template'));

        this.stats = getElementFromFragment(this._content, 'stats', 'div');
        this.statsMap = new Map();
    }

    mount(parent) {
        parent.append(this);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    update(stat, value) {
        if(typeof stat === "string")
            stat = this.skill.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component === undefined) {
            component = createElement('adventuring-stat');
            component.icon.src = stat.media;
            this.stats.appendChild(component);
            this.statsMap.set(stat, component);
        }
        if(value !== 0 || stat.base !== undefined) {
            component.show();
            component.setTooltipContent(stat.name);
            component.value.textContent = value !== 0 ? value : "-";
        } else {
            component.hide();
            component.value.textContent =  "-";
        }
    }

    delete(stat) {
        if(typeof stat === "string")
            stat = this.skill.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component !== undefined) {
            component.hide();
        }
    }
}
window.customElements.define('adventuring-stats', AdventuringStatsElement);