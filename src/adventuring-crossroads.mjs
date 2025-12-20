const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringCrossroadsElement } = await loadModule('src/components/adventuring-crossroads.mjs');

export class AdventuringCrossroads extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-crossroads');

        this.areas = [];
    }

    get active() {
        if(this.manager.dungeon.active)
            return true;
        return super.active;
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
        this.areas = this.manager.areas.allObjects;

        this.areas.forEach(area => {
            area.component.mount(this.component.areas);
        });
    }

    render() {
        this.areas.forEach(area => area.render());
    }
}