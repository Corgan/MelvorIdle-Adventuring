const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageLogUIComponent } = await loadModule('src/components/adventuring-message-log.mjs');

const { AdventuringMessage } = await loadModule('src/adventuring-message.mjs');

class AdventuringMessageLogRenderQueue {
    constructor() {
        this.messages = false;
    }
}

export class AdventuringMessageLog {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringMessageLogRenderQueue();
        this.component = new AdventuringMessageLogUIComponent(this.manager, this.game, this);

        this.messages = [];
        this.lastScrollTop = -1;
    }

    add(body) {
        let message;
        if(this.messages.length >= 50) {
            message = this.messages.shift();
        } else {
            message = new AdventuringMessage(this.manager, this.game, this);
        }
        message.body = body;
        message.ts = Date.now();
        this.messages.push(message);
        this.renderQueue.messages = true;
    }
    
    render() {
        this.renderMessages();
    }

    renderMessages() {
        if(!this.renderQueue.messages)
            return;

        let scroll = this.component.$elements[0].parentElement;

        let atBottom = scroll.clientHeight + scroll.scrollTop + 5 >= scroll.scrollHeight;

        this.messages.forEach(message => message.render());

        this.component.messages.replaceChildren(...this.messages.map(message => message.component.$elements).flat());

        if(atBottom) {
            let scrollToHeight = scroll.scrollHeight - scroll.clientHeight;
            scroll.scroll({
                top: scrollToHeight,
                left: 0,
                behavior: 'smooth'
              });
        } else {
            let scrollByHeight = this.lastScrollTop - scroll.scrollTop;
            scroll.scrollBy({
                top: -scrollByHeight,
                left: 0,
                behavior: 'smooth'
            });
            this.lastScrollTop = scroll.scrollTop;
        }

        this.renderQueue.messages = false;
    }
}