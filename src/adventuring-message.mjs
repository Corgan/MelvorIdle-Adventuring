const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageElement } = await loadModule('src/components/adventuring-message.mjs');

export class AdventuringMessage {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-message');
        this.body = "";
    }

    render() {
        this.component.body.innerHTML = this.body;
        //this.component.ts.innerHTML = this.ts;
    }
}