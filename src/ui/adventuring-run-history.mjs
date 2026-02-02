const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

await loadModule('src/ui/components/adventuring-run-history.mjs');

export class AdventuringRunHistory extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        
        this.component = createElement('adventuring-run-history');
    }
    
    onLoad() {
        super.onLoad();
        this.component.init(this.manager);
    }
    
    go() {
        super.go();
        this.component.show();
    }
    
    leave() {
        super.leave();
        this.component.hide();
    }
    
    render() {
        this.component.render();
    }
}
