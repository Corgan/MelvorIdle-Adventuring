const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringTavernUIComponent } = await loadModule('src/components/adventuring-tavern.mjs');

export class AdventuringTavern extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringTavernUIComponent(this.manager, this.game, this);

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