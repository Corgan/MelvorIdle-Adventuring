const { loadModule } = mod.getContext(import.meta);

const { AdventuringStatsElement } = await loadModule('src/core/components/adventuring-stats.mjs');

class AdventuringStatsRenderQueue {
    constructor() {
        this.stats = false;
    }
}

export class AdventuringStats extends Map {
    constructor(manager, game) {
        super();
        this.manager = manager;
        this.game = game;

        this.component = createElement('adventuring-stats');

        this.renderQueue = new AdventuringStatsRenderQueue();
    }

    get(stat) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        let value = super.get(stat);
        return value !== undefined ? value : 0;
    }

    set(stat, value) {
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(stat);
        super.set(stat, value);
    }

    reset() {
        super.forEach((value, stat) => {
            super.delete(stat);
        });
    }

    render() {
        if(!this.renderQueue.stats)
            return;
            
        this.component.statsMap.forEach((_, stat) => {
            if(super.get(stat) === undefined)
                this.component.delete(stat);
        });

        super.forEach((value, stat) => {
            this.component.update(stat, value);
        });

        this.renderQueue.stats = false;
    }
}