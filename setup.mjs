export async function setup({ gameData, patch, loadTemplates, loadModule, onInterfaceAvailable, onInterfaceReady }) {
    console.log("Loading Adventuring Templates");
    await loadTemplates("templates.html"); // Add templates

    sidebar.category('Party', { before: 'Combat' }); // Create sidebar category
  
    console.log("Loading Adventuring Module");
    const { Adventuring } = await loadModule('src/adventuring.mjs'); // Load skill

    console.log("Registering Adventuring Skill");
    game.adventuring = game.registerSkill(game.registeredNamespaces.getNamespace('adventuring'), Adventuring); // Register skill

    console.log("Registering Adventuring Data");

    await gameData.addPackage('data/base.json');

    await gameData.addPackage('data/jobs/combat/cleric.json');
    await gameData.addPackage('data/jobs/combat/fighter.json');
    await gameData.addPackage('data/jobs/combat/paladin.json');
    await gameData.addPackage('data/jobs/combat/ranger.json');
    await gameData.addPackage('data/jobs/combat/thief.json');
    await gameData.addPackage('data/jobs/combat/wizard.json');

    await gameData.addPackage('data/jobs/passive/astrologist.json');
    await gameData.addPackage('data/jobs/passive/chef.json');
    await gameData.addPackage('data/jobs/passive/crafter.json');
    await gameData.addPackage('data/jobs/passive/farmer.json');
    await gameData.addPackage('data/jobs/passive/firemaker.json');
    await gameData.addPackage('data/jobs/passive/fisherman.json');
    await gameData.addPackage('data/jobs/passive/fletcher.json');
    await gameData.addPackage('data/jobs/passive/herbalist.json');
    await gameData.addPackage('data/jobs/passive/lumberjack.json');
    await gameData.addPackage('data/jobs/passive/miner.json');
    await gameData.addPackage('data/jobs/passive/runecrafter.json');
    await gameData.addPackage('data/jobs/passive/smith.json');
    await gameData.addPackage('data/jobs/passive/summoner.json');

    await gameData.addPackage('data/items/types.json');

    await gameData.addPackage('data/items/amulet.json');
    await gameData.addPackage('data/items/body.json');
    await gameData.addPackage('data/items/cape.json');
    await gameData.addPackage('data/items/feet.json');
    await gameData.addPackage('data/items/hands.json');
    await gameData.addPackage('data/items/head.json');
    await gameData.addPackage('data/items/legs.json');
    await gameData.addPackage('data/items/offhand.json');
    await gameData.addPackage('data/items/ring.json');
    await gameData.addPackage('data/items/weapon.json');
    
    await gameData.addPackage('data/areas/chicken_coop.json');
    await gameData.addPackage('data/areas/graveyard.json');
    await gameData.addPackage('data/areas/hall_of_wizards.json');

    console.log('Registered Adventuring Data.');

    onInterfaceAvailable(async () => {
        console.log("Appending Adventuring Page");
        game.adventuring.component.mount(document.getElementById('main-container')); // Add skill container
    });
}