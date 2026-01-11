const { loadModule } = mod.getContext(import.meta);

const { AdventuringMessageLogElement } = await loadModule('src/ui/components/adventuring-message-log.mjs');

const { AdventuringMessage } = await loadModule('src/ui/adventuring-message.mjs');

class AdventuringMessageLogRenderQueue {
    constructor() {
        this.messages = false;
    }
    queueAll() {
        this.messages = true;
    }
}

export class AdventuringMessageLog {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringMessageLogRenderQueue();
        this.component = createElement('adventuring-message-log');

        this.messages = [];
    }

    add(body, type = 'info', media = null) {
        if(loadingOfflineProgress)
            return;

        let message;
        if(this.messages.length >= 50) {
            message = this.messages.shift();
        } else {
            message = new AdventuringMessage(this.manager, this.game, this);
        }
        message.body = body;
        message.type = type;
        message.media = media;
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

        let scroll = this.component.parentElement;

        let atBottom = scroll.clientHeight + scroll.scrollTop + 5 >= scroll.scrollHeight;
        let oldScrollHeight = scroll.scrollHeight;
        let oldScrollTop = scroll.scrollTop;

        this.messages.forEach(message => message.render());

        this.component.messages.replaceChildren(...this.messages.map(message => message.component));

        if(atBottom) {
            let scrollToHeight = scroll.scrollHeight - scroll.clientHeight;
            scroll.scroll({
                top: scrollToHeight,
                left: 0
              });
        } else {
            if(oldScrollHeight === scroll.scrollHeight)
                scroll.scrollBy({
                    top: scroll.scrollTop - oldScrollTop,
                    left: 0
                });
        }

        this.renderQueue.messages = false;
    }
}