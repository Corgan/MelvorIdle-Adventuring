const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringLemonsUIComponent } = await loadModule('src/components/adventuring-lemons.mjs');

export class AdventuringLemons extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringLemonsUIComponent(this.manager, this.game, this);

        this.component.back.onclick = () => this.back();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
    }

    onShow() {
        this.manager.party.all.forEach(member => member.setLocked(false));
    }

    onHide() {
        this.manager.party.all.forEach(member => member.setLocked(true));
    }

    postDataRegistration() {

    }

    render() {

    }
}