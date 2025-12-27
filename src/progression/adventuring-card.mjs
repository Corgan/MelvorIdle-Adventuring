const { loadModule } = mod.getContext(import.meta);

const { AdventuringCardElement } = await loadModule('src/progression/components/adventuring-card.mjs');

class AdventuringCardRenderQueue {
    constructor(){
        this.name = false;
        this.action = false;
        this.icon = false;
        this.highlight = false;
        this.fade = false;
    }
    updateAll() {
        this.name = true;
        this.action = true;
        this.icon = true;
        this.highlight = true;
        this.fade = true;
    }
}

export class AdventuringCard {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.renderQueue = new AdventuringCardRenderQueue();

        this.name = "";
        this.icon = cdnMedia('assets/media/main/question.png');
        this.highlight = false;
        this.fade = false;

        this.component = createElement('adventuring-card');
    }

    setHighlight(highlight) {
        this.highlight = highlight;
        this.renderQueue.highlight = true;
    }

    setFade(fade) {
        this.fade = fade;
        this.renderQueue.fade = true;
    }

    render() {
        this.renderName();
        this.renderAction();
        this.renderIcon();
        this.renderHighlight();
        this.renderFade();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.nameText.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.icon;

        this.renderQueue.icon = false;
    }

    renderAction() {
        if(!this.renderQueue.action)
            return;

        this.component.action.classList.toggle('d-none', this.action === undefined);
        this.component.action.textContent = this.action;

        this.renderQueue.action = false;
    }

    renderHighlight() {
        if(!this.renderQueue.highlight)
            return;

        this.component.styling.classList.toggle('bg-combat-menu-selected', this.highlight);

        this.renderQueue.highlight = false;
    }

    renderFade() {
        if(!this.renderQueue.fade)
            return;

        this.component.styling.classList.toggle('opacity-40', this.fade);

        this.renderQueue.fade = false;
    }
}