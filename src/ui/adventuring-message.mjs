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
        // Update body content
        this.component.body.innerHTML = this.body;
        
        // Update type class for styling
        this.component.classList.remove('msg-info', 'msg-rare', 'msg-epic', 'msg-legendary');
        this.component.classList.add(`msg-${this.type}`);
        
        // Update icon if present
        if(this.media && this.component.icon) {
            this.component.icon.src = this.media;
            this.component.icon.classList.remove('d-none');
        } else if(this.component.icon) {
            this.component.icon.classList.add('d-none');
        }
    }
}