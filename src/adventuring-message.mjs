const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageUIComponent } = await loadModule('src/components/adventuring-message.mjs');

export class AdventuringMessage {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.component = new AdventuringMessageUIComponent(this.manager, this.game, this);
        this.body = "";
    }

    render() {
        this.component.body.innerHTML = this.body;
        //this.component.ts.innerHTML = this.ts;
    }
}