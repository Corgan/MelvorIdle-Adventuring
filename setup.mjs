export async function setup({ gameData, patch, loadTemplates, loadModule, onInterfaceAvailable }) {
    await loadTemplates("templates.html"); // Add templates

    sidebar.category('Party', { before: 'Combat' }); // Create sidebar category
  
    const { Adventuring } = await loadModule('src/adventuring.mjs'); // Load skill
    game.registerSkill(game.registeredNamespaces.getNamespace('adventuring'), Adventuring); // Register skill

    await gameData.addPackage('data.json'); // Add skill data (page + sidebar, skillData)
    
    console.log('Registered Adventuring Data.');

    onInterfaceAvailable(async () => {
        const skill = game.skills.registeredObjects.get("adventuring:Adventuring");

        skill.component.mount(document.getElementById('main-container')); // Add skill container
    });
}