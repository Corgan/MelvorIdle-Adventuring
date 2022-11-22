const { loadModule } = mod.getContext(import.meta);

const { AdventuringDungeonCellUIComponent } = await loadModule('src/components/adventuring-dungeon-cell.mjs');

class AdventuringDungeonCellRenderQueue {
    constructor(){
        this.icon = false;
        this.highlight = false;
        this.fade = false;
        this.invisible = false;
    }
}

export class AdventuringDungeonCell {
    constructor(manager, game, floor) {
        this.manager = manager;
        this.game = game;
        this.floor = floor;

        this.renderQueue = new AdventuringDungeonCellRenderQueue();

        this.icon = cdnMedia('assets/media/main/question.svg');
        this.highlight = false;
        this.fade = false;
        this.invisible = false;

        this.component = new AdventuringDungeonCellUIComponent(this.manager, this.game, this);
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

    setInvisible(invisible) {
        this.invisible = invisible;
        this.renderQueue.invisible = true;
    }

    render() {
        this.renderIcon();
        this.renderHighlight();
        this.renderFade();
        this.renderInvisible();
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.icon == undefined) {
            this.component.icon.src = mod.getContext(this.manager.namespace).getResourceUrl('assets/media/empty.png');
        } else {
            this.component.icon.src = this.icon;
        }

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

    renderInvisible() {
        if(!this.renderQueue.invisible)
            return;

        this.component.styling.classList.toggle('invisible', this.invisible);

        this.renderQueue.invisible = false;
    }
}