const { loadModule } = mod.getContext(import.meta);

const { AdventuringAreaUIComponent } = await loadModule('src/components/adventuring-area.mjs');

const { AdventuringWeightedTable } = await loadModule('src/adventuring-utils.mjs');

class AdventuringAreaRenderQueue {
    constructor(){
        this.name = false;
        this.icon = false;
        this.clickable = false;
    }
}

export class AdventuringArea extends NamespacedObject {
    constructor(namespace, data, manager, game) {
        super(namespace, data.id);
        this.manager = manager;
        this.game = game;

        this.component = new AdventuringAreaUIComponent(this.manager, this.game);
        this.renderQueue = new AdventuringAreaRenderQueue();

        this.name = data.name;
        this.renderQueue.name = true;

        this._media = data.media;
        this.renderQueue.icon = true;

        this.level = data.level;

        this.floors = data.floors;

        this.height = data.height;
        this.width = data.width;

        this.tiles = data.tiles;

        this.loot = data.loot;
        
        this.lootPoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
        this.lootPoolGenerator.loadTable(this.loot.pool);
        
        if(this.tiles.treasure.loot) {
            this.treasurePoolGenerator = new AdventuringWeightedTable(this.manager, this.game);
            this.treasurePoolGenerator.loadTable(this.tiles.treasure.loot.pool);
        }

        this.component.clickable.onclick = () => {
            if(this.unlocked)
                this.manager.selectArea(this);
        }
        this.renderQueue.clickable = true;
    }

    get media() {
        return this.getMediaURL(this._media);
    }

    get unlocked() {
        return this.level <= this.manager.level;
    }

    render() {
        this.renderName();
        this.renderIcon();
        this.renderClickable();
    }

    renderName() {
        if(!this.renderQueue.name)
            return;

        if(this.unlocked) {
            this.component.name.textContent = this.name;
        } else {
            this.component.name.textContent = "???";
        }

        this.renderQueue.name = false;
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.unlocked) {
            this.component.icon.src = this.media;
        } else {
            this.component.icon.src = this.getMediaURL('melvor:assets/media/main/question.svg');
        }

        this.renderQueue.icon = false;
    }

    renderClickable() {
        if(!this.renderQueue.clickable)
            return;

        this.component.clickable.classList.toggle('pointer-enabled', this.unlocked);

        this.renderQueue.clickable = false;
    }
}