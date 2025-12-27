const { loadModule } = mod.getContext(import.meta);

const { AdventuringDungeonCellElement } = await loadModule('src/dungeon/components/adventuring-dungeon-cell.mjs');
const { describeEffect, formatRequirement } = await loadModule('src/core/adventuring-utils.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');

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

        //this.icon = cdnMedia('assets/media/main/question.png');
        this.explored = false;
        this.current = false;

        this.component = createElement('adventuring-dungeon-cell');
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

    /**
     * Get tooltip HTML for this cell
     * @returns {string} Tooltip HTML or empty string if no tooltip
     */
    get tooltip() {
        // No tooltip for empty cells or walls
        if(this.type === undefined || this.type === this.floor.wall) {
            return '';
        }

        // Show "???" for unexplored cells (unless always shown)
        if(!this.explored && !this.type.alwaysShowIcon) {
            return '<span class="text-muted">???</span>';
        }

        const tooltip = TooltipBuilder.create()
            .header(this.type.name);
        
        // Add effect descriptions if tile has effects
        if(this.type.effects && this.type.effects.length > 0) {
            tooltip.separator();
            this.type.effects.forEach(effect => {
                const desc = describeEffect(effect, this.manager);
                // Color based on effect type
                let colorClass = 'text-info';
                if(effect.type === 'damage' || effect.type === 'damage_percent' || effect.type === 'debuff') {
                    colorClass = 'text-danger';
                } else if(effect.type === 'heal' || effect.type === 'heal_percent' || effect.type === 'energy') {
                    colorClass = 'text-success';
                } else if(effect.type === 'loot') {
                    colorClass = 'text-warning';
                }
                tooltip.text(desc, colorClass);
            });
        }
        
        // Show requirements if any
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
        this.component.setTooltipContent(this.tooltip);
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