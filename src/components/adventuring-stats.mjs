const { loadModule } = mod.getContext(import.meta);

const { AdventuringUIComponent } = await loadModule('src/components/adventuring-ui-component.mjs');
const { AdventuringStatUIComponent } = await loadModule('src/components/adventuring-stat.mjs');

export class AdventuringStatsUIComponent extends AdventuringUIComponent {
    constructor(manager, game) {
        super(manager, game, 'adventuring-stats-component');

        this.stats = getElementFromFragment(this.$fragment, 'stats', 'div');

        this.statsMap = new Map();
    }

    update(stat, value) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component === undefined) {
            component = new AdventuringStatUIComponent(this.manager, this.game, this);
            component.icon.src = stat.media;
            component.mount(this.stats);
            this.statsMap.set(stat, component);
        }
        if(value !== 0 || stat.base !== undefined) {
            component.show();
            component.tooltip.setContent(stat.name);
            component.value.textContent = value !== 0 ? value : "-";
        } else {
            component.hide();
            component.value.textContent =  "-";
        }
    }

    delete(stat) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        let component = this.statsMap.get(stat);
        if(component !== undefined) {
            component.hide();
        }
    }
}