const { loadModule } = mod.getContext(import.meta);

const { AdventuringCardUIComponent } = await loadModule('src/components/adventuring-card.mjs');

class AdventuringCardRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.highlight = false;
        this.fade = false;
    }
}

export class AdventuringCard {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.renderQueue = new AdventuringCardRenderQueue();

        this.name = "";
        this.icon = cdnMedia('assets/media/main/question.svg');
        this.highlight = false;
        this.fade = false;

        this.component = new AdventuringCardUIComponent(this.manager, this.game);
    }

    setName(name) {
        this.name = name;
        this.renderQueue.name = true;
    }

    setIcon(icon) {
        this.icon = icon;
        this.renderQueue.icon = true;
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
        this.renderIcon();
        this.renderHighlight();
        this.renderFade();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        this.component.name.textContent = this.name;

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        this.component.icon.src = this.icon;

        this.renderQueue.icon = false;
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