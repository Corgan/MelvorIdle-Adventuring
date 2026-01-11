const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageElement } = await loadModule('src/ui/components/adventuring-message.mjs');

export class AdventuringMessage {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-message');
        this.body = "";
        this.type = "info";
        this.media = null;
    }

    render() {
        this.component.body.innerHTML = this.body;
        this.component.classList.remove('msg-info', 'msg-rare', 'msg-epic', 'msg-legendary');
        this.component.classList.add(`msg-${this.type}`);
        if(this.media && this.component.icon) {
            this.component.icon.src = this.media;
            this.component.icon.classList.remove('d-none');
        } else if(this.component.icon) {
            this.component.icon.classList.add('d-none');
        }
    }
}