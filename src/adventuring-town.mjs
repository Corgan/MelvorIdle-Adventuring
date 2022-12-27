const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringCard } = await loadModule('src/adventuring-card.mjs');

const { AdventuringTownUIComponent } = await loadModule('src/components/adventuring-town.mjs');

export class AdventuringTown extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringTownUIComponent(this.manager, this.game, this);
        this.buildings = new Set();
        this.characterAction = new Map();
        this.cards = new Map();
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
        if([...this.buildings].some(building => building.active))
            return true;
        return super.active;
    }

    performActions() {
        this.manager.party.all.forEach(character => this.runAction(character));
    }

    resetActions() {
        this.manager.party.all.forEach(character => {
            let newAction = this.findNewAction(character);
            this.characterAction.set(character, newAction);
            this.updateTownCards();
        });
    }

    checkActions() {
        this.manager.party.all.forEach(character => {
            if(this.characterAction.get(character) === undefined) {
                let newAction = this.findNewAction(character);
                this.characterAction.set(character, newAction);
                this.updateTownCards();
            }
        });
    }

    runAction(character) {
        if(this.characterAction.get(character) !== undefined) {
            let { action, building } = this.characterAction.get(character);
            if(action !== undefined) {
                action.execute(character, building);
            }
        }

        let newAction = this.findNewAction(character);
        if(newAction !== undefined)
            this.characterAction.set(character, newAction);
        this.updateTownCards();
    }

    findNewAction(character) {
        let actions = [...this.buildings].flatMap(building => building.availableActions(character).map(action => ({ action, building })));
        if(actions.length === 0) {
            let building = [...this.buildings][Math.floor(Math.random()*this.buildings.size)];
            let idle = this.manager.townActions.getObjectByID('adventuring:idle');

            if(this.characterAction.get(character) !== idle || Math.random() > 0.85) {
                return { building: building, action: idle };
            }
        }
        return actions[0];
    }
    
    updateTownCards() {
        this.manager.overview.cards.renderQueue.cards.clear();

        this.cards.forEach((card, character) => {
            card.name = character.name;
            card.renderQueue.name = true;

            if(this.characterAction.get(character) !== undefined) {
                let { action, building } = this.characterAction.get(character);

                if(action !== undefined) {
                    card.icon = building.media;
                    card.renderQueue.icon = true;

                    card.action = action.status;
                    card.renderQueue.action = true;
                }
            }
            this.manager.overview.cards.renderQueue.cards.add(card);
        })

        this.manager.overview.cards.renderQueue.update = true;
    }

    go() {
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
        this.updateTownCards();
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    onLoad() {
        super.onLoad();
        this.manager.party.all.forEach(member => {
            this.cards.set(member, new AdventuringCard(this.manager, this.game));
        });
        this.updateTownCards();
    }

    postDataRegistration() {
        super.postDataRegistration();
        
        this.manager.buildings.allObjects.forEach(building => {
            this.buildings.add(building);
            building.component.mount(this.component.buildings);
        });
    }

    render() {
        super.render();
        this.buildings.forEach(building => building.render());
    }

    encode(writer) {
    }

    decode(reader, version) {
    }
}