import { pvLog, pvDebug, pvWarn, pvError } from "./utils.js";
import {
  getNpcSelection,
  setNpcSelection,
  registerNpcSelectionSettings,
} from "./npcSelection.js";
import { buildPartySummaryContext } from "./viewModel.js";
import { setupGlobalDnD, setupNpcDragDrop } from "./dragDrop.js";
import { registerUiHooks } from "./uiHooks.js";

pvDebug("Script evaluated");

// Module settings
Hooks.once("init", () => {
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
    const tabs = partySummary.querySelectorAll(".party-tabs .tab-btn");
    const contents = partySummary.querySelectorAll(".tab-content");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        pvDebug("Tab click (direct)", { tab });
        this._activeTab = tab;
        tabs.forEach((b) => b.classList.toggle("active", b === btn));
        contents.forEach((c) => {
          c.style.display = c.dataset.tab === tab ? "block" : "none";
        });
      });
    });

    const npcTab = partySummary.querySelector('[data-tab="npcs"]');
    if (npcTab) {
      pvDebug("activateListeners: npcTab found, enabling DnD");
      setupNpcDragDrop(this, npcTab);
    } else {
      pvWarn("activateListeners: npcTab NOT found, DnD disabled");
    }

    // Enable dragging from our own PC cards so users can drag from the Players tab to the NPC tab
    partySummary.addEventListener("dragstart", (ev) => {
      const li = ev.target?.closest?.(".party-card[draggable][data-actor-id]");
      if (!li) return;
      const actorId = li.dataset.actorId;
      const actor = game.actors?.get(actorId);
      if (!actor) return;
      const payload = { type: "Actor", id: actor.id, uuid: actor.uuid };
      try {
        ev.dataTransfer?.setData("text/plain", JSON.stringify(payload));
        ev.dataTransfer?.setData("text/uri-list", actor.uuid);
        try {
          ev.dataTransfer.effectAllowed = "copy";
        } catch {}
        pvDebug("dragstart: set payload for actor", {
          id: actor.id,
          uuid: actor.uuid,
          type: actor.type,
        });
      } catch (e) {
        pvWarn("dragstart: failed to set dataTransfer payload", e);
      }
    });

    // Use mousedown for remove button to block click propagation before card click
    partySummary.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return; // Only left click
      if (ev.target.closest(".remove-npc-btn")) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        // Suppress any subsequent click on the card caused by this interaction
        this._suppressCardClick = true;
        const card = ev.target.closest(".party-card");
        if (!card) return;
        const id = card.dataset.actorId;
        this._removeNpc(id);
        // Clear suppression shortly after
        setTimeout(() => (this._suppressCardClick = false), 300);
      }
    });

    partySummary.addEventListener("click", (ev) => {
      // Ignore any clicks that originate from buttons inside the card (like remove)
      if (ev.target.closest(".remove-npc-btn, button")) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      // If a remove just happened, suppress opening the sheet
      if (this._suppressCardClick) {
        pvDebug("Suppressed card click after remove");
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const card = ev.target.closest(".party-card");
      if (!card) return;
      const id = card.dataset.actorId;
      const actor = game.actors?.get(id);
      pvDebug("Card clicked (direct)", {
        id,
        hasActor: !!actor,
        hasSheet: !!actor?.sheet,
      });
      if (actor?.sheet) actor.sheet.render(true);
    });
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

// Refresh Party Summary when tokens are updated in the scene
Hooks.on("updateToken", (tokenDoc, updateData, options, userId) => {
  // Only refresh if the token's actor is an NPC in our selection
  const npcIds = getNpcSelection();
  if (tokenDoc.actor && npcIds.includes(tokenDoc.actor.id)) {
    pvDebug("updateToken: refreshing Party Summary for NPC update", {
      tokenId: tokenDoc.id,
      actorId: tokenDoc.actor.id,
      actorName: tokenDoc.actor.name,
    });

    // Find and refresh any open Party Summary windows
    Object.values(ui.windows).forEach((app) => {
      if (app instanceof PartySummaryApp) {
        app.render(false); // Use false to avoid repositioning the window
      }
    });
  }
});

// Refresh when actors are updated (fallback for non-token updates)
Hooks.on("updateActor", (actorDoc, updateData, options, userId) => {
  const npcIds = getNpcSelection();
  if (actorDoc.type === "npc" && npcIds.includes(actorDoc.id)) {
    pvDebug("updateActor: refreshing Party Summary for NPC update", {
      actorId: actorDoc.id,
      actorName: actorDoc.name,
    });

    // Find and refresh any open Party Summary windows
    Object.values(ui.windows).forEach((app) => {
      if (app instanceof PartySummaryApp) {
        app.render(false);
      }
    });
  }
});

// Refresh when scene changes (to pick up different tokens)
Hooks.on("canvasReady", () => {
  pvDebug("canvasReady: refreshing Party Summary for scene change");

  // Find and refresh any open Party Summary windows
  Object.values(ui.windows).forEach((app) => {
    if (app instanceof PartySummaryApp) {
      app.render(false);
    }
  });
});
