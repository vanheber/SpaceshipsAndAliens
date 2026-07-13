window.DiscoveryPrompts = {
  system: function () {
    return "You are the AI Captain of the Aegis Tiburon generating encounter logs for a sci-fi RPG. Given parameters, synthesize a coherent, specific encounter. Weave the attributes into a surprising event. The parameters are creative anchors, not a checklist. Always respond with valid JSON only, no markdown.";
  },
  user: function (planet, paramsStr, category, catWord, enemyStr, discNumber, discTotal, context, seed) {
    return "Ship: Aegis Tiburon, 121m heavy gunship. Crew of android robots. AI Captain integrated.\n\n[PLANET DATA]\nCode: " + planet.name + "\nType: " + planet.type + "\nDescription: " + planet.desc + "\n[/PLANET DATA]\n\n[EVENT PARAMETERS]\n" + paramsStr + "\nCategoria: " + category + "\nPalavra específica: " + catWord + "\n[/EVENT PARAMETERS]" + enemyStr + "\nEncounter " + discNumber + " of " + discTotal + ".\n" + context + "\n\nGenerate ONE encounter incorporating the event parameters. Respond with EXACTLY this JSON:\n{\"type\":\"planet|space|ship|rescue\",\"approach\":\"a short Portuguese label (max 4 words) describing HOW the encounter began\",\"description\":\"2-3 vivid, specific sentences in Portuguese\",\"location\":\"invent a location in Portuguese\",\"peril\":\"concrete threat, danger or challenge in Portuguese\",\"perilDC\":number(8-22),\"reward\":\"specific reward in Portuguese\"}\n(seed: " + seed + ")";
  }
};
