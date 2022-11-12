export async function setup({ gameData, patch, loadTemplates, loadModule, onInterfaceReady }) {
    await loadTemplates("templates.html"); // Add templates

    sidebar.category('Party', { before: 'Combat' }); // Create sidebar category
  
    const { Adventuring } = await loadModule('src/adventuring.mjs'); // Load skill
    game.registerSkill(game.registeredNamespaces.getNamespace('adventuring'), Adventuring); // Register skill

    await gameData.addPackage('data.json'); // Add skill data (page + sidebar, skillData)

    // UI Setup
    onInterfaceReady(async () => {
        const skill = game.skills.registeredObjects.get("adventuring:Adventuring");

        skill.component.mount(document.getElementById('main-container')); // Add skill container

        /*
            initMenus _again_
        */
        const header = document.getElementById(`skill-header-${skill.id}`);
        if (header !== null) {
            const options = createElement('mastery-skill-options', {
                className: 'pl-1 pr-1'
            });
            header.append(options);
            options.setSkill(skill);
        }
        
        const elems = {
            level: [document.getElementById(`skill-progress-level-adventuring:Adventuring`)],
            percent: [],
            xp: [document.getElementById(`skill-progress-xp-adventuring:Adventuring`)],
            progress: [document.getElementById(`skill-progress-bar-adventuring:Adventuring`)],
            tooltip: [],
        };

        const navItem = sidebar.category('Party').item(skill.id);
        const nav = {
            item: navItem,
            name: navItem.nameEl,
            levelAll: navItem.asideEl,
            level: createElement('span', { text: '1' }),
        };
        nav.levelAll.append('(', nav.level, ` / ${skill.levelCap})`);

        skillProgressDisplay.elems.set(skill, elems);
        skillNav.navs.set(skill, [nav]);

        sidebar.category('Non-Combat').item(skill.id).remove();

        if(!game.tutorial.shouldStart && !game.isGolbinRaid)
            changePage(game.settings.defaultPageOnLoad, -1, undefined, false, false);
    })
}