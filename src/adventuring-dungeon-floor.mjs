const { loadModule } = mod.getContext(import.meta);

const { AdventuringDungeonCell } = await loadModule('src/adventuring-dungeon-cell.mjs');

const { AdventuringDungeonFloorUIComponent } = await loadModule('src/components/adventuring-dungeon-floor.mjs');

class AdventuringDungeonFloorRenderQueue {
    constructor() {
        this.cells = new Set();
    }
}

export class AdventuringDungeonFloor {
    static tiles = {
        wall: 0,
        empty: 1,
        start: 2,
        exit: 3,
        treasure: 4,
        trap: 5,
        fountain: 6,
    }

    static typeMask =     0b01111111; // 127
    static exploredFlag = 0b10000000; //+128

    constructor(manager, game, dungeon) {
        this.manager = manager;
        this.game = game;
        this.dungeon = dungeon;

        this.renderQueue = new AdventuringDungeonFloorRenderQueue();

        this.component = new AdventuringDungeonFloorUIComponent(this.manager, this.game);

        this.grid = [];

        this.height = 0;
        this.width = 0;

        this.currentPos = [-1, -1];

        this.floorCells = [];
        this.cellRowEnds = [];
        this.hasExtra = false;
    }

    reset() {
        this.grid = [];
        this.height = 0;
        this.width = 0;
        this.currentPos = [-1, -1];
        this.emptyCount = 0;
        this.hasExtra = false;
    }

    step() {
        let [oX, oY, type, explored] = this.current;

        if(type == this.constructor.tiles.empty) {
            //console.log('empty');
        } else if(type == this.constructor.tiles.start) {
            //console.log('start');
        } else if(type == this.constructor.tiles.exit) {
            //console.log('exit');
            this.dungeon.triggerEncounter(true);
            return;
        } else if (type == this.constructor.tiles.treasure) {
            //console.log("treasure");
            this.dungeon.triggerTreasure();
        } else if (type == this.constructor.tiles.trap) {
            //console.log("trap");
            this.dungeon.triggerTrap();
        } else if (type == this.constructor.tiles.fountain) {
            //console.log("fountain");
            this.dungeon.triggerFountain();
        } else {
            //console.log("uh oh", type);
        }

        this.set(oX, oY, type, true);

        for(let x = 0; x < this.width; x++) {
            for(let y = 0; y < this.height; y++) {
                if(this.canMoveTo(x, y)) {
                    this.move(x, y);
                    return;
                }
            }
        }
    }

    get current() {
        let [x, y] = this.currentPos;
        return [x, y, ...this.at(x, y)];
    }

    generate(height=5, width=8) {
        this.reset();

        this.height = height;
        this.width = width;

        for (let y = 0; y < height; y++)
            this.grid.push(new Array(width).fill(0));

        let [x, y] = [0, Math.floor(Math.random() * height)];


        y = Math.max(1, Math.min(height - 2, y));
        this.set(x, y, this.constructor.tiles.start); // start
        this.currentPos = [x, y];

        let exitMade = false;

        while (!exitMade) {
            let pCount = 0;
            for (x = 0; x < this.width; x++) {
                for (y = 0; y < this.height; y++) {
                    let [type, explored] = this.at(x, y);
                    if (type != this.constructor.tiles.wall) {
                        pCount += this.makePassage(x, y, 1, 0);
                            this.makePassage(x, y, -1, 0) +
                            this.makePassage(x, y, 0, -1) +
                            this.makePassage(x, y, 0, 1)
                    }
                }
            }
            if (pCount == 0) {
                for (y = 0; y < this.height; y++) {
                    let [type, explored] = this.at(this.width - 2, y);
                    if (type != this.constructor.tiles.wall) {
                        this.set(this.width - 1, y, this.constructor.tiles.exit);
                        exitMade = true;
                        break;
                    }
                }
            }
        }

        this.updateFloor();
    }

    makePassage(x, y, i, j) {
        if(this.is(x + i,     y + j,     this.constructor.tiles.wall) &&
           this.is(x + i + j, y + j + i, this.constructor.tiles.wall) &&
           this.is(x + i - j, y + j - i, this.constructor.tiles.wall)) {
            if (this.is(x + i + i,     y + j + j,     this.constructor.tiles.wall) &&
                this.is(x + i + i + j, y + j + j + i, this.constructor.tiles.wall) &&
                this.is(x + i + i - j, y + j + j - i, this.constructor.tiles.wall)) {
                if (Math.random() > 0.50) {
                    let type = this.chooseTile();
                    this.set(x + i, y + j, type);
                    return 1;
                }
            }
        }
        return 0;
    }

    chooseTile() {
        if(this.emptyCount >= 2 && !this.hasExtra) {
            if(this.dungeon.treasureCount < this.dungeon.area.tiles.treasure.max) {
                if(Math.random() <= this.dungeon.area.tiles.treasure.chance) {
                    this.dungeon.treasureCount++;
                    this.hasExtra = true;
                    return this.constructor.tiles.treasure;
                }
            }
            if(this.dungeon.fountainCount < this.dungeon.area.tiles.fountain.max) {
                if(Math.random() <= this.dungeon.area.tiles.fountain.chance) {
                    this.dungeon.fountainCount++;
                    this.hasExtra = true;
                    return this.constructor.tiles.fountain;
                }
            }
            if(this.dungeon.trapCount < this.dungeon.area.tiles.trap.max) {
                if(Math.random() <= this.dungeon.area.tiles.trap.chance) {
                    this.dungeon.trapCount++;
                    this.hasExtra = true;
                    return this.constructor.tiles.trap;
                }
            }
        }

        this.emptyCount++;
        return this.constructor.tiles.empty;
    }

    maskon(type, explored) {
        let value = type;
        if(explored)
            value |= this.constructor.exploredFlag;
        return value;
    }

    // fuck it
    maskoff(value) {
        let type = value & this.constructor.typeMask;
        let explored = (value & this.constructor.exploredFlag) == this.constructor.exploredFlag;
        return [type, explored];
    }

    canMoveTo(x, y) {
        let [type, explored] = this.at(x, y);
        if(type == this.constructor.tiles.wall || explored) // We can't move to walls or explored tiles
            return false;
        return this.canMoveFrom(x, y+1) || this.canMoveFrom(x, y-1) || this.canMoveFrom(x+1, y) || this.canMoveFrom(x-1, y);
    }

    canMoveFrom(x, y) {
        let [type, explored] = this.at(x, y);
        return type == this.constructor.tiles.start || explored; // explored or start
    }
    
    move(x, y) {
        this.currentPos = [x, y];
        this.updateFloor();
    }

    at(x, y) {
        if (this.grid[y] != undefined && this.grid[y][x] != undefined) {
            return this.maskoff(this.grid[y][x]);
        }
        return [-1, false];
    }

    is(x, y, checkType) {
        let [type, explored] = this.at(x, y)
        return type == checkType;
    }

    set(x, y, type, explored=false) {
        if (this.grid[y] != undefined && this.grid[y][x] != undefined)
            this.grid[y][x] = this.maskon(type, explored);
    }

    updateFloor() {
        let [cX, cY] = this.currentPos;
        let i = 0;
        let rowEnds = 0;
        for(let y = 0; y < this.height; y++) {
            for(let x = 0; x < this.width; x++) {
                i = x + (this.width * y);

                let [type, explored] = this.at(x, y);

                if(this.floorCells[i] == undefined)
                    this.floorCells[i] = new AdventuringDungeonCell(this.manager, this.game, this);

                this.floorCells[i].setInvisible(type == this.constructor.tiles.wall);
                this.floorCells[i].setHighlight(x == cX && y == cY);
                this.floorCells[i].setFade(explored && !(x == cX && y == cY));

                if(type == this.constructor.tiles.exit) {
                    if(this.dungeon.progress == this.dungeon.floorCount-1) {
                        this.floorCells[i].setIcon(cdnMedia('assets/media/main/hardcore.svg')); // Boss Exit
                    } else {
                        this.floorCells[i].setIcon(cdnMedia('assets/media/misc/mark_of_death.svg')); // Encounter Exit
                    }
                } else if(type == this.constructor.tiles.start) {
                    this.floorCells[i].setIcon(cdnMedia('assets/media/main/question.svg')); // Start
                } else {
                    if(explored) {
                        if(type == this.constructor.tiles.empty) {
                            this.floorCells[i].setIcon(); // Explored Empty
                        } else if (type == this.constructor.tiles.treasure) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/main/bank_header.svg'));
                        } else if (type == this.constructor.tiles.trap) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/status/poison.svg'));
                        } else if (type == this.constructor.tiles.fountain) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/skills/firemaking/firemaking.svg'));
                        }
                    } else {
                        this.floorCells[i].setIcon(cdnMedia('assets/media/main/question.svg')); // Unexplored
                    }
                }

                this.renderQueue.cells.add(this.floorCells[i]);
            }
            if(this.cellRowEnds[rowEnds] == undefined)
                this.cellRowEnds[rowEnds] = createElement('div', { className: 'w-100' });
            
            this.renderQueue.cells.add(this.cellRowEnds[rowEnds++]);
        }
    }

    render() {
        this.renderCells();
    }

    renderCells() {
        if(this.renderQueue.cells.size === 0)
            return;

        let cells = [...this.renderQueue.cells];

        cells.filter(cell => cell instanceof AdventuringDungeonCell).forEach(cell => cell.render());

        this.component.floor.replaceChildren(...cells.map(cell => {
            if(cell instanceof AdventuringDungeonCell)
               return cell.component.$elements;
            return cell;
        }).flat());

        this.renderQueue.cells.clear();
    }

    encode(writer) {
        writer.writeUint8(this.height);
        writer.writeUint8(this.width);
        writer.writeUint8(this.currentPos[0]);
        writer.writeUint8(this.currentPos[1]);

        writer.writeArray(this.grid, (row, writer) => {
            writer.writeArray(row, (cell, writer) => {
                writer.writeUint8(cell);
            });
        });
        return writer;
    }

    decode(reader, version) {
        this.height = reader.getUint8();
        this.width = reader.getUint8();
        this.currentPos = [reader.getUint8(), reader.getUint8()];
        this.grid = reader.getArray((reader) => {
            return reader.getArray((reader) => {
                return reader.getUint8();
            });
        });
    }
}