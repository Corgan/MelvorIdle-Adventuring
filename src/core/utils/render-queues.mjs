/**
 * Render queue classes for Adventuring mod UI components.
 * These track which parts of UI components need to be re-rendered.
 */

export class AdventuringMasteryRenderQueue {
    constructor() {
        this.name = false;
        this.tooltip = false;
        this.icon = false;
        this.clickable = false;
        this.mastery = false;
    }

    queueAll() {
        this.name = true;
        this.tooltip = true;
        this.icon = true;
        this.clickable = true;
        this.mastery = true;
    }

    updateAll() {
        this.queueAll();
    }
}

export class AdventuringBadgeRenderQueue extends AdventuringMasteryRenderQueue {
    constructor() {
        super();
        this.newBadge = false;
    }

    queueAll() {
        super.queueAll();
        this.newBadge = true;
    }
}

export class AdventuringEquipmentRenderQueue extends AdventuringBadgeRenderQueue {
    constructor() {
        super();

        this.name = undefined;
        this.clickable = undefined;
        this.mastery = undefined;

        this.upgrade = false;
        this.selected = false;
        this.highlight = false;
        this.equipped = false;
    }

    queueAll() {
        this.tooltip = true;
        this.icon = true;
        this.newBadge = true;
        this.upgrade = true;
        this.selected = true;
        this.highlight = true;
        this.equipped = true;
    }
}
