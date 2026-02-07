export function registerModuleSettings() {
  game.settings.register("partyview", "debugLogging", {
    name: "Enable Debug Logging",
    hint: "Show verbose debug logs in the console for troubleshooting.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
  });
  game.settings.register("partyview", "showIcons", {
    name: "Show Icons",
    hint: "Display actor icons in party cards.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register("partyview", "allowPlayersView", {
    name: "Allow Players to View PC Tab",
    hint: "Allow non-GM players to see the Player Characters tab (but not NPCs).",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
  game.settings.register("partyview", "portraitSource", {
    name: "Portrait Source",
    hint: "Choose whether to display actor character portrait or token image in party cards.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      image: "Actor Portrait",
      token: "Token Image",
    },
    default: "image",
  });
}
