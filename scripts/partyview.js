import { pvLog, pvDebug, pvWarn, pvError } from "./utils.js";
import {
  getNpcSelection,
  setNpcSelection,
  registerNpcSelectionSettings,
} from "./npcSelection.js";
import { buildPartySummaryContext } from "./viewModel.js";
import {
  setupGlobalDnD,
  setupNpcDragDrop,
  setupPartyCardDrag,
} from "./dragDrop.js";
import { registerUiHooks } from "./uiHooks.js";
import { registerModuleSettings } from "./settings.js";
import { registerRefreshHooks } from "./refreshHooks.js";
import { setupPartyTabs } from "./tabs.js";
import { setupCardInteractions } from "./cardInteractions.js";

pvDebug("Script evaluated");

// Module settings
Hooks.once("init", () => {
  registerModuleSettings();
});

class PartySummaryApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  constructor(...args) {
    super(...args);
  }

  static DEFAULT_OPTIONS = {
    id: "party-summary-app",
    window: { title: "Party Summary", icon: "fa-solid fa-users" },
    position: { width: 560, height: "auto" },
  };

  static PARTS = {
    content: { template: "modules/partyview/templates/party-summary.hbs" },
  };

  async _prepareContext(_options) {
    return buildPartySummaryContext({ activeTab: this._activeTab });
  }

  async getData(options = {}) {
    return this._prepareContext(options);
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const partySummary = root.querySelector(".party-summary");
    if (!partySummary) return;
    pvDebug("activateListeners: wiring tab buttons and card click");
    setupPartyTabs(partySummary, this);

    const npcTab = partySummary.querySelector('[data-tab="npcs"]');
    if (npcTab) {
      pvDebug("activateListeners: npcTab found, enabling DnD");
      setupNpcDragDrop(this, npcTab);
    } else {
      pvWarn("activateListeners: npcTab NOT found, DnD disabled");
    }

    // Enable dragging from our own PC cards so users can drag from the Players tab to the NPC tab
    setupPartyCardDrag(partySummary);
    setupCardInteractions(partySummary, this);
  }

  async _addNpc(actorId) {
    const current = getNpcSelection();
    if (!current.includes(actorId)) {
      const updated = [...current, actorId];
      pvDebug("Adding NPC", { actorId, count: updated.length });
      await setNpcSelection(updated);
      this._activeTab = "npcs";
      this.render(true);
    }
  }

  async _removeNpc(actorId) {
    const current = getNpcSelection();
    const updated = current.filter((id) => id !== actorId);
    pvDebug("Removing NPC", { actorId, count: updated.length });
    await setNpcSelection(updated);
    this.render(true);
  }
}

registerUiHooks(PartySummaryApp);
registerRefreshHooks(PartySummaryApp);

Hooks.once("init", () => {
  pvLog("Initializing", {
    version: foundry?.utils?.getProperty?.(globalThis, "game.version"),
  });
  registerNpcSelectionSettings();
  pvDebug("Settings at init", {
    showIcons: game.settings?.get("partyview", "showIcons"),
    npcSelection: game.settings?.get("partyview", "npcSelection"),
    npcSelectionClient: game.settings?.get("partyview", "npcSelectionClient"),
  });
});

// Log when the world is fully ready
Hooks.once("ready", () => {
  const mod = game.modules?.get?.("partyview");
  pvLog("Ready", {
    world: game.world?.id,
    moduleActive: !!mod?.active,
    moduleVersion: mod?.version,
  });
});
