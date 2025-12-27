const { loadModule } = mod.getContext(import.meta);

export class AdventuringPage {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
    }

    get active() {
        if(this.manager.pages.current === this)
            return true;
    }

    go() {
        this.manager.pages.go(this);
    }

    onShow() { }

    onHide() { }

    onLoad() { }

    onPageChange() {
        // Called when the main game page changes - override in subclasses if needed
    }

    postDataRegistration() {

    }

    render() {

    }

    reset() {
        // Override in subclasses to reset state
    }

    getErrorLog() {
        return '';
    }

    encode(writer) {
    }

    decode(reader, version) {
    }
}