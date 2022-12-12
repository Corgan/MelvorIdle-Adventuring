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

    get name() {
        if(this.building !== undefined) {
            return this.building.name;
        }
        return "Town";
    }

    get media() {
        if(this.building !== undefined) {
            return this.building.media;
        }
        return cdnMedia("assets/media/skills/township/Town_Hall.svg");
    }

    get active() {
        if(this.buildings.some(building => building.active))
            return true;
        return super.active;
    }

    updateTownCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        let cards = [];
        cards.push(...this.manager.party.all.map(c => c.townCard));
        cards.forEach(card => {
            this.manager.overview.cards.renderQueue.cards.add(card);
        })

        this.manager.overview.cards.renderQueue.update = true;
    }

    go() {
        this.updateTownCards();
        if(this.building !== undefined && this.building.page !== undefined) {
            if(!this.building.active) {
                this.building.go();
            }
        } else {
            super.go();
        }
    }

    setBuilding(building) {
        if(typeof building === "string")
            building = this.manager.buildings.getObjectByID(building);
        if(building === undefined || building.page !== undefined)
            this.building = building;
        if(this.active)
            this.go();
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