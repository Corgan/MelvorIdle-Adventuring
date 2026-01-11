const { loadModule } = mod.getContext(import.meta);

const { AdventuringDungeonCellElement } = await loadModule('src/dungeon/components/adventuring-dungeon-cell.mjs');
const { describeEffect, formatRequirement } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

class AdventuringDungeonCellRenderQueue {
    constructor() {
        this.type = false;
        this.current = false;
        this.tooltip = false;
    }
    queueAll() {
        this.type = true;
        this.current = true;
        this.tooltip = true;
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
        this.explored = false;
        this.current = false;

        this.component = createElement('adventuring-dungeon-cell');
    }

    onLoad() {
        this.renderQueue.type = true;
        this.renderQueue.current = true;
        this.renderQueue.tooltip = true;
    }

    is(type) {
        return this.type === type;
    }

    set(type, explored=false) {
        this.type = type;
        this.explored = explored;
        this.renderQueue.type = true;
        this.renderQueue.tooltip = true;
    }

    setAltIcon(alt) {
        this.alt = true;
        this.renderQueue.type = true;
    }

    setExplored(explored) {
        this.explored = explored;
        this.renderQueue.type = true;
        this.renderQueue.tooltip = true;
    }

    setCurrent(current) {
        this.current = current;
        this.renderQueue.current = true;
    }

    render() {
        this.renderType();
        this.renderCurrent();
        this.renderTooltip();
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
                this.component.icon.src = cdnMedia('assets/media/main/question.png');
            }
        }

        this.component.styling.classList.toggle('d-none', this.type === undefined);
        this.component.styling.classList.toggle('opacity-40', this.explored);
        this.component.styling.classList.toggle('invisible', this.type !== undefined && this.type === this.floor.wall);

        this.renderQueue.type = false;
    }

    get tooltip() {
        if(this.type === undefined || this.type === this.floor.wall) {
            return '';
        }
        if(!this.explored && !this.type.alwaysShowIcon) {
            return TooltipBuilder.create()
                .header('???')
                .build();
        }

        const tooltip = TooltipBuilder.create()
            .header(this.type.name);
        if(this.type.id === 'adventuring:exit') {
            tooltip.separator();
            tooltip.text('Clear all enemies to advance to the next floor.', 'text-info');
        } else if(this.type.id === 'adventuring:boss') {
            tooltip.separator();
            tooltip.text('Defeat the boss to complete the dungeon!', 'text-danger');
        } else if(this.type.id === 'adventuring:encounter') {
            tooltip.separator();
            tooltip.text('A group of enemies blocks your path.', 'text-warning');
        } else if(this.type.id === 'adventuring:start') {
            tooltip.separator();
            tooltip.text('Your party enters the dungeon here.', 'text-muted');
        } else if(this.type.id === 'adventuring:empty') {
            tooltip.separator();
            tooltip.text('Nothing of interest.', 'text-muted');
        }
        if(this.type.effects && this.type.effects.length > 0) {
            tooltip.separator();
            this.type.effects.forEach(effect => {
                const desc = describeEffect(effect, this.manager);
                let colorClass = 'text-info';
                if(effect.type === 'damage' || effect.type === 'damage_flat' || effect.type === 'damage_percent' || effect.type === 'debuff') {
                    colorClass = 'text-danger';
                } else if(effect.type === 'heal' || effect.type === 'heal_flat' || effect.type === 'heal_percent' || effect.type === 'energy') {
                    colorClass = 'text-success';
                } else if(effect.type === 'loot') {
                    colorClass = 'text-warning';
                }
                tooltip.text(desc, colorClass);
            });
        }
        if(this.type.requirements && this.type.requirements.length > 0) {
            tooltip.separator();
            this.type.requirements.forEach(req => {
                const { text } = formatRequirement(req, this.manager);
                tooltip.text(text, 'text-muted');
            });
        }

        return tooltip.build();
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderCurrent() {
        if(!this.renderQueue.current)
            return;

        this.component.styling.classList.toggle('bg-combat-menu-selected', this.current);

        this.renderQueue.current = false;
    }

    encode(writer, tileMap) {
        let value = this.type !== undefined ? tileMap.indexOf(this.type) : 0;
        if(value < 0) value = 0; // Fallback if type not found in tileMap
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
        this.explored = (value & AdventuringDungeonCell.exploredFlag) === AdventuringDungeonCell.exploredFlag;
    }
}