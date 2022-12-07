const { loadModule } = mod.getContext(import.meta);

const { AdventuringCardsUIComponent } = await loadModule('src/components/adventuring-cards.mjs');

class AdventuringCardsRenderQueue {
    constructor() {
        this.cards = new Set();
        this.update = false;
    }
}

export class AdventuringCards {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.renderQueue = new AdventuringCardsRenderQueue();
        this.component = new AdventuringCardsUIComponent(this.manager, this.game, this);
    }
    
    render() {
        this.renderCards();
    }

    renderCards() {
        if(this.renderQueue.cards.size === 0 && !this.renderQueue.update)
            return;

        let cards = [...this.renderQueue.cards];

        cards.forEach(card => card.render());

        this.component.cards.replaceChildren(...cards.map(card => card.component.$elements).flat());

        this.renderQueue.cards.clear();
        this.renderQueue.update = false;
    }
}