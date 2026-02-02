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
        
        // Optional reference to owner character for effective stat calculation
        this.owner = null;
    }

    setOwner(owner) {
        this.owner = owner;
        // Also set on component for breakdown tooltips
        if (this.component) {
            this.component.setCharacter(owner);
        }
    }

    get(statID) {
        let stat = statID;
        if(typeof stat === "string")
            stat = this.manager.stats.getObjectByID(statID);
        if(stat === undefined) {
            console.warn('AdventuringStats.get: Unknown stat', statID);
            return 0;
        }
        let value = super.get(stat);
        return value !== undefined ? value : 0;
    }

    set(statID, value) {
        let stat = statID;
        if(typeof statID === "string")
            stat = this.manager.stats.getObjectByID(statID);
        if(stat === undefined) {
            console.warn('AdventuringStats.set: Unknown stat', statID);
            return;
        }
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

        // Track which stats we've displayed to avoid duplicates
        const displayedStats = new Set();

        // First, show stats that are in the Map (base stats)
        super.forEach((value, stat) => {
            // Use effective stat value if owner is set and can calculate it
            let displayValue = value;
            if(this.owner && typeof this.owner.getEffectiveStat === 'function') {
                displayValue = this.owner.getEffectiveStat(stat);
            }
            this.component.update(stat, displayValue);
            displayedStats.add(stat);
        });
        
        // Also check for stats from effectCache that might not have base values
        // (e.g., herblore from Herbalist passive job)
        if (this.owner && typeof this.owner.getEffectiveStat === 'function') {
            this.manager.stats.forEach(stat => {
                if (displayedStats.has(stat)) return; // Already displayed
                
                const effectiveValue = this.owner.getEffectiveStat(stat);
                if (effectiveValue !== 0) {
                    this.component.update(stat, effectiveValue);
                    displayedStats.add(stat);
                }
            });
        }

        // Hide stats that are no longer in the displayed set
        this.component.statsMap.forEach((_, stat) => {
            if(!displayedStats.has(stat)) {
                this.component.delete(stat);
            }
        });

        this.renderQueue.stats = false;
    }
}