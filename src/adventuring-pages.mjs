const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

export class AdventuringPages {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.pages = new Set();
        this.active = false;
    }

    onLoad() {
        this.pages.forEach(p => p.onLoad());
    }

    go(page) {
        if(page instanceof AdventuringPage && page !== this.active) {
            this.pages.forEach(p => {
                if(p !== page) {
                    p.component.hide();
                    p.onHide();
                }
            });

            this.active = page;

            page.component.show();
            page.onShow();
        }

        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buttons = true;
    }

    register(page) {
        if(page instanceof AdventuringPage) {
            this.pages.add(page);
            page.component.mount(this.manager.component.subpages);
        }
    }

    render() {
        this.pages.forEach(p => p.render());
    }
}