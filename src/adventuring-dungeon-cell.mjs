const { loadModule } = mod.getContext(import.meta);

const { AdventuringDungeonCellUIComponent } = await loadModule('src/components/adventuring-dungeon-cell.mjs');

class AdventuringDungeonCellRenderQueue {
    constructor() {
        this.type = false;
        this.current = false;
    }
}

export class AdventuringDungeonCell {
    static typeMask =     0b01111111; // 127
    static exploredFlag = 0b10000000; //+128

    constructor(manager, game, floor) {
        this.manager = manager;
        this.game = game;
        this.floor = floor;

        this.renderQueue = new AdventuringDungeonCellRenderQueue();

        //this.icon = cdnMedia('assets/media/main/question.svg');
        this.explored = false;
        this.current = false;

        this.component = new AdventuringDungeonCellUIComponent(this.manager, this.game, this);
    }

    onLoad() {
        this.renderQueue.type = true;
        this.renderQueue.current = true;
    }

    is(type) {
        return this.type === type;
    }

    set(type, explored=false) {
        this.type = type;
        this.explored = explored;
        this.renderQueue.type = true;
    }

    setAltIcon(alt) {
        this.alt = true;
        this.renderQueue.type = true;
    }

    setExplored(explored) {
        this.explored = explored;
        this.renderQueue.type = true;
    }

    setCurrent(current) {
        this.current = current;
        this.renderQueue.current = true;
    }

    render() {
        this.renderType();
        this.renderCurrent();
    }

    renderType() {
        if(!this.renderQueue.type)
            return;

        if(this.type === undefined) {
            this.component.icon.src = mod.getContext(this.manager.namespace).getResourceUrl('assets/media/empty.png');
        } else {
            if(this.explored || this.type.alwaysShowIcon) {
                this.component.icon.src = this.type.media;
            } else {
                this.component.icon.src = cdnMedia('assets/media/main/question.svg');
            }
        }

        this.component.styling.classList.toggle('d-none', this.type === undefined);
        this.component.styling.classList.toggle('opacity-40', this.explored);
        this.component.styling.classList.toggle('invisible', this.type !== undefined && this.type === this.floor.wall);

        this.renderQueue.type = false;
    }

    renderCurrent() {
        if(!this.renderQueue.current)
            return;

        this.component.styling.classList.toggle('bg-combat-menu-selected', this.current);

        this.renderQueue.current = false;
    }

    encode(writer, tileMap) {
        let value = tileMap.indexOf(this.type);
        if(this.explored)
            value |= AdventuringDungeonCell.exploredFlag;
        writer.writeUint8(value);
        return writer;
    }

    decode(reader, version, tileMap) {
        let value = reader.getUint8();
        let mapIdx = value & AdventuringDungeonCell.typeMask;
        let type = tileMap[mapIdx];
        if(type !== undefined && typeof type !== "string")
            this.type = type;
        this.explored = (value & AdventuringDungeonCell.exploredFlag) == AdventuringDungeonCell.exploredFlag;
    }
}