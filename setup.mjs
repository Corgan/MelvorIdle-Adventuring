export async function setup({ gameData, patch, loadTemplates, loadModule, onInterfaceAvailable, onInterfaceReady }) {
    console.log("Loading Acventuring Templates");
    await loadTemplates("templates.html"); // Add templates

    sidebar.category('Party', { before: 'Combat' }); // Create sidebar category
  
    console.log("Loading Acventuring Module");
    const { Adventuring } = await loadModule('src/adventuring.mjs'); // Load skill

    console.log("Registering Acventuring Skill");
    game.registerSkill(game.registeredNamespaces.getNamespace('adventuring'), Adventuring); // Register skill

    console.log("Registering Adventuring Data");
    await gameData.addPackage('data.json'); // Add skill data (page + sidebar, skillData)

    console.log('Registered Adventuring Data.');

    onInterfaceAvailable(async () => {
        const skill = game.skills.registeredObjects.get("adventuring:Adventuring");

        console.log("Appending Adventuring Page");
        skill.component.mount(document.getElementById('main-container')); // Add skill container
    });

    onInterfaceReady(async () => {
        document.querySelector('#skill-header-adventuring\\:Adventuring > mastery-skill-options').spendMasteryButton.classList.add('d-none');
    })
}