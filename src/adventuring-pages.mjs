const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

export class AdventuringPages {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;
        this.pages = new Set();
        this.byId = new Map();
        this.current = false;
    }

    onLoad() {
        this.pages.forEach(p => p.onLoad());
    }

    postDataRegistration() {
        this.pages.forEach(p => p.postDataRegistration());
    }

    go(page) {
        if(page instanceof AdventuringPage && page !== this.current) {
            this.pages.forEach(p => {
                if(p !== page) {
                    p.component.hide();
                    p.onHide();
                }
            });

            this.current = page;

            page.component.show();
            page.onShow();
        }

        this.manager.overview.renderQueue.status = true;
        this.manager.overview.renderQueue.buttons = true;
    }

    register(id, page) {
        if(page instanceof AdventuringPage) {
            this.pages.add(page);
            this.byId.set(id, page);
            page.component.mount(this.manager.component.subpages);
        }
    }

    render() {
        this.pages.forEach(p => p.render());
    }

    encode(writer) {
        writer.writeComplexMap(this.byId, (key, value, writer) => {
            writer.writeString(key);
            value.encode(writer);
        });
        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getString();
            let page = this.byId.get(key);
            page.decode(reader, version);
        });
    }
}