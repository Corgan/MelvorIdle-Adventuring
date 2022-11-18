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
        encounter: 7
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

        this.forkStack = [];

        this.floorCells = [];
        this.cellRowEnds = [];
        this.hasExtra = false;
    }

    onLoad() {
        if(this.grid.length > 0)
            this.updateFloor();
    }

    reset() {
        this.grid = [];
        this.height = 0;
        this.width = 0;
        this.currentPos = [-1, -1];
        this.forkStack = [];
        this.emptyCount = 0;
        this.hasExtra = false;
    }

    step() {
        let [oX, oY, type, explored] = this.current;
        let shouldMove = true;

        if(type == AdventuringDungeonFloor.tiles.empty) {

        } else if(type == AdventuringDungeonFloor.tiles.start) {
            
        } else if(type == AdventuringDungeonFloor.tiles.exit) {
            this.dungeon.triggerExit();
        } else if (type == AdventuringDungeonFloor.tiles.treasure) {
            this.dungeon.triggerTreasure();
        } else if (type == AdventuringDungeonFloor.tiles.trap) {
            this.dungeon.triggerTrap();
        } else if (type == AdventuringDungeonFloor.tiles.fountain) {
            this.dungeon.triggerFountain();
        } else if (type == AdventuringDungeonFloor.tiles.encounter) {
            this.dungeon.triggerEncounter();
        } else {
            
        }

        this.set(oX, oY, type, true);

        if(type == AdventuringDungeonFloor.tiles.exit)
            return;

        let [mX, mY] = this.getBestMove(oX, oY);

        if(this.canMoveTo(mX, mY)) {
            this.move(mX, mY);
            return;
        }

        for(let y = 0; y < this.height; y++) {
            for(let x = 0; x < this.width; x++) {
                if(this.canMoveTo(x, y)) {
                    this.move(x, y);
                    return;
                }
            }
        }
    }

    getBestMove(x, y, fromStack=false) {
        let nodes = [];

        if(this.canMoveTo(x - 1, y) && !this.is(x - 1, y, AdventuringDungeonFloor.tiles.exit))
            nodes.push([x - 1, y]);

        if(this.canMoveTo(x + 1, y) && !this.is(x + 1, y, AdventuringDungeonFloor.tiles.exit))
            nodes.push([x + 1, y]);

        if(this.canMoveTo(x, y - 1) && !this.is(x, y - 1, AdventuringDungeonFloor.tiles.exit))
            nodes.push([x, y - 1]);

        if(this.canMoveTo(x, y + 1) && !this.is(x, y + 1, AdventuringDungeonFloor.tiles.exit))
            nodes.push([x, y + 1]);
        
        if(nodes.length > 0) {
            if(nodes.length > 1)
                fromStack ? this.forkStack.unshift([x, y]) : this.forkStack.push([x, y]);
            return nodes[Math.floor(Math.random() * nodes.length)];
        } else {
            if(this.forkStack.length > 0) {
                let [fX, fY] = this.forkStack.shift();
                return this.getBestMove(fX, fY, true);
            } else {
                return [-1, -1];
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

        let [x, y] = [Math.floor(Math.random() * width), 0];


        x = Math.max(Math.min(width - 2, x), 1);
        this.set(x, y, AdventuringDungeonFloor.tiles.start); // start
        this.currentPos = [x, y];

        let exitMade = false;

        while (!exitMade) {
            let pCount = 0;
            for (y = 0; y < this.height; y++) {
                for (x = 0; x < this.width; x++) {
                    let [type, explored] = this.at(x, y);
                    if (type != AdventuringDungeonFloor.tiles.wall) {
                        pCount += this.makePassage(x, y, 0, 1);
                            this.makePassage(x, y, 0, -1) +
                            this.makePassage(x, y, -1, 0) +
                            this.makePassage(x, y, 1, 0)
                    }
                }
            }
            if (pCount == 0) {
                for (x = 0; x < this.height; x++) {
                    let [type, explored] = this.at(x, this.height - 2);
                    if (type != AdventuringDungeonFloor.tiles.wall) {
                        this.set(x, this.height - 1, AdventuringDungeonFloor.tiles.exit);
                        exitMade = true;
                        break;
                    }
                }
            }
        }

        this.updateFloor();
    }

    makePassage(x, y, i, j) {
        if(this.is(x + i, y + j, AdventuringDungeonFloor.tiles.wall)) {
            if(this.is(x + i + i, y + j + j, AdventuringDungeonFloor.tiles.wall) &&
               this.is(x + i + j, y + j + i, AdventuringDungeonFloor.tiles.wall) &&
               this.is(x + i - j, y + j - i, AdventuringDungeonFloor.tiles.wall)) {
                if (Math.random() > 0.25) {
                    let type = this.chooseTile(x + i, y + j);
                    this.set(x + i, y + j, type);
                }
                return 1;
            }
        }
        return 0;
    }

    chooseTile(x, y) {
        if(this.emptyCount >= 2 && !this.hasExtra) {
            if(this.dungeon.treasureCount < this.dungeon.area.tiles.treasure.max) {
                if(Math.random() <= this.dungeon.area.tiles.treasure.chance) {
                    this.dungeon.treasureCount++;
                    this.hasExtra = true;
                    return AdventuringDungeonFloor.tiles.treasure;
                }
            }
            if(this.dungeon.fountainCount < this.dungeon.area.tiles.fountain.max) {
                if(Math.random() <= this.dungeon.area.tiles.fountain.chance) {
                    this.dungeon.fountainCount++;
                    this.hasExtra = true;
                    return AdventuringDungeonFloor.tiles.fountain;
                }
            }
            if(this.dungeon.trapCount < this.dungeon.area.tiles.trap.max) {
                if(Math.random() <= this.dungeon.area.tiles.trap.chance) {
                    this.dungeon.trapCount++;
                    this.hasExtra = true;
                    return AdventuringDungeonFloor.tiles.trap;
                }
            }
        }
        this.emptyCount++;
        
        if(this.emptyCount >= 2 && Math.random() <= this.dungeon.area.tiles.encounter.chance) {
            if( !this.is(x + 1, y, AdventuringDungeonFloor.tiles.encounter) &&
                !this.is(x - 1, y, AdventuringDungeonFloor.tiles.encounter) &&
                !this.is(x, y + 1, AdventuringDungeonFloor.tiles.encounter) &&
                !this.is(x, y - 1, AdventuringDungeonFloor.tiles.encounter))
            return AdventuringDungeonFloor.tiles.encounter;
        }

        return AdventuringDungeonFloor.tiles.empty;
    }

    maskon(type, explored) {
        let value = type;
        if(explored)
            value |= AdventuringDungeonFloor.exploredFlag;
        return value;
    }

    // fuck it
    maskoff(value) {
        let type = value & AdventuringDungeonFloor.typeMask;
        let explored = (value & AdventuringDungeonFloor.exploredFlag) == AdventuringDungeonFloor.exploredFlag;
        return [type, explored];
    }

    canMoveTo(x, y) {
        let [type, explored] = this.at(x, y);
        if(type == -1 || type == AdventuringDungeonFloor.tiles.wall || explored) // We can't move to walls or explored tiles
            return false;
        return this.canMoveFrom(x, y+1) || this.canMoveFrom(x, y-1) || this.canMoveFrom(x+1, y) || this.canMoveFrom(x-1, y);
    }

    canMoveFrom(x, y) {
        let [type, explored] = this.at(x, y);
        return type == AdventuringDungeonFloor.tiles.start || explored; // explored or start
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

                this.floorCells[i].setInvisible(type == AdventuringDungeonFloor.tiles.wall);
                this.floorCells[i].setHighlight(x == cX && y == cY);
                this.floorCells[i].setFade(explored && !(x == cX && y == cY));

                if(type == AdventuringDungeonFloor.tiles.exit) {
                    if(this.dungeon.progress == this.dungeon.numFloors-1) {
                        this.floorCells[i].setIcon(cdnMedia('assets/media/main/hardcore.svg')); // Boss Exit
                    } else {
                        this.floorCells[i].setIcon(cdnMedia('assets/media/misc/mark_of_death.svg')); // Encounter Exit
                    }
                } else if(type == AdventuringDungeonFloor.tiles.start) {
                    this.floorCells[i].setIcon(cdnMedia('assets/media/main/question.svg')); // Start
                } else {
                    if(explored) {
                        if(type == AdventuringDungeonFloor.tiles.empty) {
                            this.floorCells[i].setIcon(); // Explored Empty
                        } else if (type == AdventuringDungeonFloor.tiles.treasure) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/main/bank_header.svg'));
                        } else if (type == AdventuringDungeonFloor.tiles.trap) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/status/poison.svg'));
                        } else if (type == AdventuringDungeonFloor.tiles.fountain) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/skills/firemaking/firemaking.svg'));
                        } else if (type == AdventuringDungeonFloor.tiles.encounter) {
                            this.floorCells[i].setIcon(cdnMedia('assets/media/misc/mark_of_death.svg')); // Encounter
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

    complete() {
        this.manager.dungeon.progress++;
        this.manager.overview.renderQueue.status = true;

        if(this.manager.dungeon.progress >= this.manager.dungeon.numFloors) {
            this.manager.dungeon.complete();
        } else {
            this.manager.dungeon.next();
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
        writer.writeArray(this.forkStack, (row, writer) => {
            writer.writeUint8(row[0]);
            writer.writeUint8(row[1]);
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
        if(this.manager.saveVersion >= 2) {
            this.forkStack = reader.getArray((reader) => {
                return [reader.getUint8(), reader.getUint8()];
            });
        }
    }
}