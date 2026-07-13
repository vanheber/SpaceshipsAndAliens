window.PlanetPrompts = {
  system: function () {
    return "You are a planetary survey AI. You will receive a set of planetary attributes. You MUST use the EXACT attributes provided — do NOT replace, reinterpret, or override any of them with alternatives. Every attribute must appear in your output. The creativity is in HOW you connect them, not in changing them. Always respond with valid JSON only, no markdown, no other text.";
  },
  user: function (paramsStr, seed) {
    return "Generate a planet with these scan attributes:\n" + paramsStr + "\n\nBuild a name (code like XX-999a), a short type label in Portuguese (max 4 words), and a 2-3 sentence description that incorporates ALL attributes above. Don't list them flatly — create connections, tensions, and surprises. What does the crew see, feel, and measure on arrival? Respond with EXACTLY this JSON only:\n{\"name\":\"XX-999a\",\"type\":\"type label\",\"desc\":\"description\"}\n(seed: " + seed + ")";
  }
};
