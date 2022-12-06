const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringCrossroadsUIComponent } = await loadModule('src/components/adventuring-crossroads.mjs');

export class AdventuringCrossroads extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringCrossroadsUIComponent(this.manager, this.game, this);

        this.areas = [];
    }

    onLoad() {
        super.onLoad();
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