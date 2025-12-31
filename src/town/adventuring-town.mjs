const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');
const { AdventuringCard } = await loadModule('src/progression/adventuring-card.mjs');

const { AdventuringTownElement } = await loadModule('src/town/components/adventuring-town.mjs');

export class AdventuringTown extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-town');
        this.buildings = new Set();
        this.characterAction = new Map();
        this.cards = new Map();
    }

    get name() {
        return "Town";
    }

    get media() {
        return cdnMedia("assets/media/skills/township/Town_Hall.svg");
    }

    get active() {
        if([...this.buildings].some(building => building.active))
            return true;
        return super.active;
    }

    performActions() {
        // Check if auto-repeat dungeon should start (party at full HP)
        if(this.manager.autoRepeatArea && this.checkAutoRepeatReady()) {
            this.manager.log.add(`Auto-run: Starting ${this.manager.autoRepeatArea.name}...`);
            this.manager.selectArea(this.manager.autoRepeatArea);
            return;
        }

        this.manager.party.all.forEach(character => this.runAction(character));
    }

    /**
     * Check if conditions are met to auto-start the repeat dungeon
     * Requires all party members to be alive and at full HP
     */
    checkAutoRepeatReady() {
        return this.manager.party.all.every(member => 
            !member.dead && member.hitpoints >= member.maxHitpoints
        );
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
        // Always go to main town page, clear any building selection
        this.building = undefined;
        super.go();
    }

    setBuilding(building) {
        if(typeof building === "string")
            building = this.manager.buildings.getObjectByID(building);
        if(building === undefined || building.page !== undefined)
            this.building = building;
        if(building && building.page !== undefined) {
            // Go to the building's subpage directly
            building.go();
        } else if(this.active) {
            this.go();
        }
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