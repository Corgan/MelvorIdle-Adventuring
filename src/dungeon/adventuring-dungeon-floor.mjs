const { loadModule } = mod.getContext(import.meta);

const { AdventuringWeightedTable } = await loadModule('src/core/adventuring-utils.mjs');
const { AdventuringDungeonCell } = await loadModule('src/dungeon/adventuring-dungeon-cell.mjs');

const { AdventuringDungeonFloorElement } = await loadModule('src/dungeon/components/adventuring-dungeon-floor.mjs');

class AdventuringDungeonFloorRenderQueue {
    constructor() {
        this.cells = false;
    }
    queueAll() {
        this.cells = true;
    }
}

export class AdventuringDungeonFloor {
    constructor(manager, game, dungeon) {
        this.manager = manager;
        this.game = game;
        this.dungeon = dungeon;
        this.tileMap = [];

        this.renderQueue = new AdventuringDungeonFloorRenderQueue();

        this.component = createElement('adventuring-dungeon-floor');

        this.grid = [];

        this.height = 0;
        this.width = 0;

        this.currentPos = [-1, -1];

        this.forkStack = [];

        this.floorCells = [];
        this.cellRowEnds = [];
        this.tileTable = new AdventuringWeightedTable(this.manager, this.game);
        this.tileCount = new Map();
        this.hasExtra = false;
    }

    onLoad() {
        this.renderQueue.cells = true;
        this.grid.forEach(cell => cell.onLoad());
    }

    postDataRegistration() {
        this.tileMap = [...this.manager.tiles.allObjects];
        this.empty = this.manager.tiles.getObjectByID('adventuring:empty');
        this.wall = this.manager.tiles.getObjectByID('adventuring:wall');
        this.start = this.manager.tiles.getObjectByID('adventuring:start');
        this.exit = this.manager.tiles.getObjectByID('adventuring:exit');
        this.boss = this.manager.tiles.getObjectByID('adventuring:boss');
        this.encounter = this.manager.tiles.getObjectByID('adventuring:encounter');
    }

    get current() {
        return this.at(...this.currentPos);
    }

    reset() {
        this.tileCount.clear();
        this.manager.tiles.allObjects.forEach(tile => {
            this.tileCount.set(tile, 0);
        });
        this.grid.forEach(cell => {
            cell.set(this.wall);
            cell.setCurrent(false);
        });
        this.height = 0;
        this.width = 0;
        this.currentPos = [-1, -1];
        this.forkStack = [];
        this.emptyCount = 0;
        this.hasExtra = false;
    }

    step() {
        let current = this.current;

        this.dungeon.triggerTile(current);

        current.setExplored(true);

        if(current.type === this.exit || current.type === this.boss)
            return;

        let [mX, mY] = this.getBestMove();

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

    getBestMove(fromStack=false) {
        let [x, y] = this.currentPos;
        if(fromStack)
            [x, y] = this.forkStack.shift();
        let nodes = [];

        if(this.canMoveTo(x - 1, y) && !this.is(x - 1, y, this.exit))
            nodes.push([x - 1, y]);

        if(this.canMoveTo(x + 1, y) && !this.is(x + 1, y, this.exit))
            nodes.push([x + 1, y]);

        if(this.canMoveTo(x, y - 1) && !this.is(x, y - 1, this.exit))
            nodes.push([x, y - 1]);

        if(this.canMoveTo(x, y + 1) && !this.is(x, y + 1, this.exit))
            nodes.push([x, y + 1]);
        
        if(nodes.length > 0) {
            if(nodes.length > 1)
                fromStack ? this.forkStack.unshift([x, y]) : this.forkStack.push([x, y]);
            return nodes[Math.floor(Math.random() * nodes.length)];
        } else {
            if(this.forkStack.length > 0) {
                return this.getBestMove(true);
            } else {
                return [-1, -1];
            }
        }
    }

    generate(height=5, width=4) {
        this.reset();

        this.height = height;
        this.width = width;

        if(this.grid.length < this.height * this.width)
            for(let i = this.grid.length; i < this.height * this.width; i++)
                this.grid.push(new AdventuringDungeonCell(this.manager, this.game, this));

        if(this.grid.length > this.height * this.width)
            for(let i = this.grid.length - (this.height * this.width); i < this.grid.length; i++)
                this.grid[i].set();
            
        for(let i = 0; i < this.grid.length; i++)
            this.grid[i].set(this.wall);

        this.currentPos = [Math.max(Math.min(this.width - 2, Math.floor(Math.random() * this.width)), 1), 0];
        this.current.set(this.start);

        let exitMade = false;
        let exitRepeats = 0;
        while (!exitMade && exitRepeats <= 5) {
            let pCount = 0;
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.at(x, y);
                    if(!cell.is(this.wall)) {
                        pCount += this.makePassage(x, y, 0, 1);
                            this.makePassage(x, y, 0, -1) +
                            this.makePassage(x, y, -1, 0) +
                            this.makePassage(x, y, 1, 0)
                    }
                }
            }
            if (pCount === 0) {
                exitRepeats++;
                for (let x = 0; x < this.width; x++) {
                    let cell = this.at(x, this.height - 2);
                    if(!cell.is(this.wall)) {
                        let exitCell = this.at(x, this.height - 1);
                        let type = this.dungeon.progress === this.dungeon.numFloors-1 ? this.boss : this.exit;
                        exitCell.set(type);
                        exitMade = true;
                        break;
                    }
                }
            }
        }

        this.renderQueue.cells = true;
    }

    makePassage(x, y, i, j) {
        if(this.is(x + i, y + j, this.wall)) {
            if(this.is(x + i + i, y + j + j, this.wall) &&
               this.is(x + i + j, y + j + i, this.wall) &&
               this.is(x + i - j, y + j - i, this.wall)) {
                if (Math.random() > 0.25) {
                    let type = this.chooseTile(x + i, y + j);
                    this.set(x + i, y + j, type);
                    this.dungeon.tileCount.set(type, this.dungeon.tileCount.get(type) + 1);
                    this.tileCount.set(type, this.tileCount.get(type) + 1);
                }
                return 1;
            }
        }
        return 0;
    }

    chooseTile(x, y) {
        // Get tile modifiers from dungeon mastery
        const area = this.dungeon.area;
        const tileModifiers = area ? area.getTileModifiers() : {};
        
        // Check if current floor has no random encounters
        const hasMonsters = this.dungeon.currentFloor && this.dungeon.currentFloor.monsters && this.dungeon.currentFloor.monsters.length > 0;
        
        let toLoad = this.manager.tiles.allObjects.filter(tile => {
            if(tile.weight === undefined)
                return false;
            if(!tile.spawnable)
                return false;
            // Skip encounter tiles if floor has no monsters
            if(!hasMonsters && tile === this.encounter)
                return false;
            if(tile.dungeon_max !== undefined && tile.dungeon_max !== -1 && this.dungeon.tileCount.get(tile) >= tile.dungeon_max)
                return false;
            if(tile.floor_max !== undefined && tile.floor_max !== -1 && this.tileCount.get(tile) >= tile.floor_max)
                return false;
            
            // Check if tile requires mastery unlock (weight 0 until unlocked)
            if(tile.masteryUnlock) {
                const modifier = tileModifiers[tile.id] || 0;
                if(modifier <= 0) return false;
            }
            
            return true;
        }).map(tile => {
            // Apply mastery-based weight modifiers
            const modifier = tileModifiers[tile.id];
            if(modifier !== undefined) {
                return { ...tile, weight: Math.floor(tile.weight * modifier) };
            }
            return tile;
        }).filter(tile => tile.weight > 0); // Remove tiles with 0 weight

        // Fallback to empty if no tiles available
        if(toLoad.length === 0)
            return this.empty;

        let entry = this.tileTable.loadTable(toLoad).getEntry();
        if(entry === undefined)
            return this.empty;

        return this.manager.tiles.getObjectByID(entry.id) || this.empty;
        
        /*if(this.emptyCount >= 2 && Math.random() <= this.encounter.chance) {
            if( !this.is(x + 1, y, this.encounter) &&
                !this.is(x - 1, y, this.encounter) &&
                !this.is(x, y + 1, this.encounter) &&
                !this.is(x, y - 1, this.encounter))
            return this.encounter;
        }*/

        return this.empty;
    }

    canMoveTo(x, y) {
        let cell = this.at(x, y);
        if(cell === false || cell.type === this.wall || cell.explored) // We can't move to walls or explored tiles
            return false;
        return this.canMoveFrom(x, y+1) || this.canMoveFrom(x, y-1) || this.canMoveFrom(x+1, y) || this.canMoveFrom(x-1, y);
    }

    canMoveFrom(x, y) {
        let cell = this.at(x, y);
        return cell !== false && (cell.type === this.start || cell.explored);
    }
    
    move(x, y) {
        this.current.setCurrent(false);
        this.currentPos = [x, y];
        this.current.setCurrent(true);
    }

    at(x, y) {
        if(x >= this.width || y >= this.height || x < 0 || y < 0)
            return false;
        let i = x + (this.width * y);
        if (this.grid[i] !== undefined)
            return this.grid[i];
        return false;
    }

    is(x, y, type) {
        let cell = this.at(x, y);
        return cell !== false && cell.type === type;
    }

    set(x, y, type, explored=false) {
        if(x >= this.width || y >= this.height || x < 0 || y < 0)
            return false;
        let i = x + (this.width * y);
        if (this.grid[i] !== undefined) {
            this.grid[i].set(type, explored);
            return this.grid[i];
        }
        return false;
    }

    complete() {
        // Use centralized trigger system for floor_end
        this.manager.triggerEffects('floor_end', {});
        
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

        this.grid.forEach(cell => cell.render());
    }

    renderCells() {
        if(!this.renderQueue.cells)
            return;

        if(this.grid.length < this.height * this.width)
            return;

        let cells = [];
        let rowEnds = 0;
        for(let y = 0; y < this.height; y++) {
            for(let x = 0; x < this.width; x++) {
                let i = x + (this.width * y);
                if(this.grid[i] === undefined)
                    continue;
                this.grid[i].setCurrent(this.current === this.grid[i]);
                cells.push(this.grid[i]);
            }

            if(this.cellRowEnds[rowEnds] === undefined)
                this.cellRowEnds[rowEnds] = createElement('div', { className: 'w-100' });
        
            cells.push(this.cellRowEnds[rowEnds++]);
        }

        cells.forEach(cell => {
            if(cell.render !== undefined)
                cell.render();
        });

        this.component.floor.replaceChildren(...cells.map(cell => {
            if(cell.component !== undefined)
               return cell.component;
            return cell;
        }));

        this.renderQueue.cells = false;
    }

    encode(writer) {
        writer.writeUint8(this.height);
        writer.writeUint8(this.width);
        writer.writeUint8(this.currentPos[0]);
        writer.writeUint8(this.currentPos[1]);

        writer.writeArray(this.tileMap, (tile, writer) => {
            writer.writeNamespacedObject(tile);
        });
        // Only encode cells up to expected grid size
        let expectedSize = this.height * this.width;
        let grid = this.grid.slice(0, expectedSize);
        writer.writeArray(grid, (cell, writer) => {
            cell.encode(writer, this.tileMap);
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

        let tileMap = reader.getArray((reader) => {
            let tile = reader.getNamespacedObject(this.manager.tiles);
            return tile;
        });
        this.grid = reader.getArray((reader) => {
            let cell = new AdventuringDungeonCell(this.manager, this.game, this);
            cell.decode(reader, version, tileMap);
            return cell;
        });

        // Ensure grid has the correct number of cells
        const expectedSize = this.height * this.width;
        while(this.grid.length < expectedSize) {
            let cell = new AdventuringDungeonCell(this.manager, this.game, this);
            cell.set(this.wall);
            this.grid.push(cell);
        }

        this.forkStack = reader.getArray((reader) => {
            return [reader.getUint8(), reader.getUint8()];
        });
    }
}