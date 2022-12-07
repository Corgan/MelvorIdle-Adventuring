const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringTownUIComponent } = await loadModule('src/components/adventuring-town.mjs');

export class AdventuringTown extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringTownUIComponent(this.manager, this.game, this);
        this.buildingLevels = new Map();
    }

    get active() {
        if(this.buildings.some(building => building.active))
            return true;
        return super.active;
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    onLoad() {
        super.onLoad();
    }

    postDataRegistration() {
        super.postDataRegistration();
        
        this.buildings = this.manager.buildings.allObjects;
        this.buildings.forEach(building => {
            this.buildingLevels.set(building, 0);
            building.component.mount(this.component.buildings);
        });
    }

    render() {
        super.render();
        this.buildings.forEach(building => building.render());
    }
}