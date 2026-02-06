// Party View for Foundry VTT v13
// Adds a Party Summary button in the Actors directory

import {
  pvLog,
  pvDebug,
  pvWarn,
  pvError,
  getProp,
  formatAbbrev,
} from "./utils.js";
import {
  getNpcSelection,
  setNpcSelection,
  registerNpcSelectionSettings,
} from "./npcSelection.js";

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
    // Use debugLogging setting for debug output
    const debugEnabled = game.settings?.get("partyview", "debugLogging");
    const debug = debugEnabled ? pvDebug : () => {};
    debug("_prepareContext: start", { system: game.system?.id });
    const isDnd5e = game.system?.id === "dnd5e";
    const pcs =
      game.actors?.filter((a) =>
        isDnd5e
          ? a.hasPlayerOwner && a.type === "character"
          : a.hasPlayerOwner && a.type !== "npc",
      ) ?? [];
    debug("_prepareContext: PCs found", { count: pcs.length });

    const toRow = (a) => {
      if (isDnd5e) {
        const level = getProp(a, "system.details.level") ?? "";
        const ac = getProp(a, "system.attributes.ac.value") ?? "";
        const hpCurr = getProp(a, "system.attributes.hp.value") ?? "";
        const hpMax = getProp(a, "system.attributes.hp.max") ?? "";
        const hpTemp = getProp(a, "system.attributes.hp.temp") ?? "";
        const hpTempMax = getProp(a, "system.attributes.hp.tempmax") ?? "";
        const pp = getProp(a, "system.skills.prc.passive") ?? "";
        const cur =
          getProp(a, "system.currency") ||
          getProp(a, "system.currencies") ||
          {};
        const coinsRaw = {
          pp: Number(cur.pp ?? 0),
          gp: Number(cur.gp ?? 0),
          sp: Number(cur.sp ?? 0),
          cp: Number(cur.cp ?? 0),
        };
        const coins = {
          pp: coinsRaw.pp,
          gp: coinsRaw.gp,
          sp: coinsRaw.sp,
          cp: coinsRaw.cp,
          ppDisp: formatAbbrev(coinsRaw.pp),
          gpDisp: formatAbbrev(coinsRaw.gp),
          spDisp: formatAbbrev(coinsRaw.sp),
          cpDisp: formatAbbrev(coinsRaw.cp),
        };
        // Legendary Actions / Resistances (best-effort across dnd5e versions)
        let legendaryActions = undefined;
        const laMax = getProp(a, "system.resources.legact.max");
        const laVal = getProp(a, "system.resources.legact.value");
        if (Number.isFinite(laMax)) legendaryActions = Number(laMax);
        else if (Number.isFinite(laVal)) legendaryActions = Number(laVal);

        // Legendary Resistances can be in resources or on a Feat with uses
        let legendaryResist = undefined;
        const lrVal = getProp(a, "system.resources.legres.value");
        const lrMax = getProp(a, "system.resources.legres.max");
        if (Number.isFinite(lrVal) || Number.isFinite(lrMax)) {
          const maxValue = Number(lrMax ?? 0);
          if (maxValue > 0) {
            legendaryResist = {
              value: Number(lrVal ?? 0),
              max: maxValue,
            };
          }
        } else {
          const lrFeat = a.items?.find?.(
            (it) =>
              it.type === "feat" && /legendary resistance/i.test(it.name || ""),
          );
          const fVal = getProp(lrFeat, "system.uses.value");
          const fMax = getProp(lrFeat, "system.uses.max");
          if (Number.isFinite(fVal) || Number.isFinite(fMax)) {
            const maxValue = Number(fMax ?? 0);
            if (maxValue > 0) {
              legendaryResist = {
                value: Number(fVal ?? 0),
                max: maxValue,
              };
            }
          }
        }
        // Detect Regeneration (best-effort): scan items for a feature/feat named *Regeneration*
        const hasRegen = !!a.items?.some?.((it) =>
          /regeneration|regenerate/i.test(it?.name || ""),
        );
        let classes = [];
        const classItems = a.items?.filter?.((it) => it.type === "class") ?? [];
        const clsObj = a.classes ?? undefined;
        if (clsObj && typeof clsObj === "object") {
          classes = Object.values(clsObj)
            .map((c) => {
              const name = c?.name ?? "";
              const lv =
                c?.system?.levels ??
                c?.system?.level ??
                c?.system?.levels?.value ??
                "";
              return `${name}${lv ? ` ${lv}` : ""}`.trim();
            })
            .filter(Boolean);
        } else if (classItems.length) {
          classes = classItems
            .map((c) => {
              const name = c?.name ?? "";
              const lv =
                c?.system?.levels ??
                c?.system?.level ??
                c?.system?.levels?.value ??
                "";
              return `${name}${lv ? ` ${lv}` : ""}`.trim();
            })
            .filter(Boolean);
        }
        return {
          id: a.id,
          name: a.name,
          img: a.img,
          level,
          ac,
          hp: (() => {
            if (hpCurr === "" && hpMax === "") return "";
            let display = `${hpCurr}`;
            if (hpTemp && Number(hpTemp) > 0) {
              display += `<span class=\"pv-hp-bonus\">+${hpTemp}</span>`;
            }
            if (hpMax) {
              display += ` / ${hpMax}`;
              if (hpTempMax && Number(hpTempMax) > 0) {
                display += `<span class=\"pv-hp-bonus\">+${hpTempMax}</span>`;
              }
            }
            return display;
          })(),
          classes: classes.join(" / "),
          pp,
          coins,
          legendaryActions,
          legendaryResist,
          hasRegen,
        };
      }
      const level =
        getProp(a, "system.details.level") ??
        getProp(a, "system.attributes.level") ??
        getProp(a, "system.level") ??
        "";
      const ac =
        getProp(a, "system.attributes.ac.value") ??
        getProp(a, "system.attributes.ac") ??
        getProp(a, "system.abilities.ac.value") ??
        "";
      const hpCurr =
        getProp(a, "system.attributes.hp.value") ??
        getProp(a, "system.attributes.hp.current") ??
        getProp(a, "system.hp.value") ??
        "";
      const hpMax =
        getProp(a, "system.attributes.hp.max") ??
        getProp(a, "system.hp.max") ??
        "";
      return {
        id: a.id,
        name: a.name,
        img: a.img,
        level,
        ac,
        hp:
          hpCurr !== "" || hpMax !== ""
            ? `${hpCurr}${hpMax ? ` / ${hpMax}` : ""}`
            : "",
      };
    };

    const rows = pcs.map(toRow);

    const npcIds = getNpcSelection();
    debug("_prepareContext: NPC ids from settings", { npcIds });

    // Prioritize NPCs from active scene, fall back to base actors
    const npcDocs = npcIds
      .map((id) => {
        // Check active scene first
        const sceneToken = game.scenes?.active?.tokens?.find(
          (t) => t.actor?.id === id,
        );
        if (sceneToken?.actor) {
          debug("_prepareContext: Using scene token for NPC", {
            id,
            name: sceneToken.actor.name,
          });
          return sceneToken.actor;
        }

        // Fall back to base actor
        const baseActor = game.actors?.get(id);
        if (baseActor) {
          debug("_prepareContext: Using base actor for NPC", {
            id,
            name: baseActor.name,
          });
        }
        return baseActor;
      })
      .filter(Boolean);

    const npcs = npcDocs.map(toRow);
    debug("_prepareContext: NPC docs and rows", {
      docs: npcDocs.length,
      rows: npcs.length,
      fromScene: npcDocs.filter((doc) => doc.isToken).length,
      fromBase: npcDocs.filter((doc) => !doc.isToken).length,
    });

    const showIcons = game.settings?.get("partyview", "showIcons") ?? true;
    const allowPlayersView =
      game.settings?.get("partyview", "allowPlayersView") ?? false;
    const isGM = game.user?.isGM ?? false;
    const canViewSummary = isGM || allowPlayersView;
    const activeTab = this._activeTab || "players";
    debug("_prepareContext: complete", {
      actors: rows.length,
      npcs: npcs.length,
      showIcons,
      isGM,
      allowPlayersView,
      canViewSummary,
      activeTab,
    });
    return {
      actors: rows,
      showIcons,
      isGM,
      allowPlayersView,
      canViewSummary,
      npcs,
      selectedNpcIds: npcIds,
      activeTab,
    };
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

    // Set up drag and drop for NPC tab
    const npcTab = partySummary.querySelector('[data-tab="npcs"]');
    if (npcTab) {
      pvDebug("activateListeners: npcTab found, enabling DnD");
      this._setupNpcDragDrop(npcTab);
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

  _setupNpcDragDrop(npcTab) {
    pvDebug("Setting up drag and drop for NPC tab");
    // Capture-phase listeners to reliably receive events even when hovering children
    npcTab.addEventListener(
      "dragenter",
      (ev) => {
        pvDebug("DnD: dragenter on npcTab", { target: ev.target?.className });
        npcTab.classList.add("drag-over");
      },
      true,
    );

    npcTab.addEventListener(
      "dragover",
      (ev) => {
        pvDebug("DnD: dragover on npcTab");
        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "copy";
        } catch {}
        npcTab.classList.add("drag-over");
      },
      true,
    );

    npcTab.addEventListener(
      "dragleave",
      () => {
        pvDebug("DnD: dragleave on npcTab");
        npcTab.classList.remove("drag-over");
      },
      true,
    );

    npcTab.addEventListener("drop", (ev) => {
      pvDebug("DnD: drop start on npcTab");
      ev.preventDefault();
      npcTab.classList.remove("drag-over");
      try {
        const dt = ev.dataTransfer;
        const types = Array.from(dt?.types ?? []);
        const plain = dt?.getData("text/plain") || "";
        const uris = dt?.getData("text/uri-list") || "";
        const plainPreview = plain?.slice?.(0, 200) ?? "";
        pvDebug("Drop event types", {
          types,
          plainLen: plain.length,
          urisLen: uris.length,
          plainPreview,
        });

        let payload = null;
        if (plain) {
          try {
            payload = JSON.parse(plain);
          } catch {
            // Not JSON; may be a UUID string
          }
        }

        const handleActor = (actorDoc) => {
          if (!actorDoc) return false;
          if (actorDoc.documentName === "TokenDocument")
            actorDoc = actorDoc.actor;
          if (actorDoc?.documentName === "Actor") {
            if (actorDoc.type === "npc") {
              this._activeTab = "npcs";
              this._addNpc(actorDoc.id);
              return true;
            }
            ui.notifications?.warn(
              "Only NPC actors can be added to the NPC tab.",
            );
            return false;
          }
          return false;
        };

        // Case 1: JSON payload (typical directory/sheet drag)
        if (payload && payload.type) {
          pvDebug("Parsed JSON payload", payload);
          if (payload.type === "Actor") {
            let doc = null;
            if (payload.uuid) doc = fromUuidSync(payload.uuid);
            if (!doc && payload.id) doc = game.actors?.get(payload.id) ?? null;
            if (!handleActor(doc))
              pvWarn("Actor doc not resolved or not NPC", payload);
            return;
          }
          if (payload.type === "Token") {
            let doc = null;
            if (payload.uuid) doc = fromUuidSync(payload.uuid);
            if (!handleActor(doc))
              pvWarn("Token doc not resolved or no actor", payload);
            return;
          }
        }

        // Case 2: UUID string in plain or uri-list
        const uuidStr = [plain, uris].find((s) =>
          /^(Actor\.|Token\.|Compendium\.)/.test(s?.trim?.() ?? ""),
        );
        if (uuidStr) {
          pvDebug("UUID-like string dropped", uuidStr);
          const doc = fromUuidSync(uuidStr.trim());
          if (!handleActor(doc))
            pvWarn("UUID did not resolve to an NPC Actor", uuidStr);
          return;
        }

        // Unknown payload
        pvWarn("Unrecognized drop payload", { types, plain, uris });
        ui.notifications?.warn(
          "Unable to read drop data. Please drag from the Actors directory or a UUID link.",
        );
      } catch (err) {
        pvWarn("Failed to parse drop data", err);
      }
    });
  }

  _setupGlobalDnD(npcTab) {
    // Avoid duplicating listeners
    if (this._globalDnDActive) return;
    this._globalDnDActive = true;
    pvDebug("Setting up global DnD fallback");

    const onDocDragOver = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const inside = !!el?.closest?.(".npc-drop-zone");
      if (!inside) return;
      pvDebug("Global DnD: dragover inside npc-drop-zone");
      ev.preventDefault();
    };

    const onDocDrop = (ev) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const zone = el?.closest?.(".npc-drop-zone");
      if (!zone) return;
      pvDebug("Global DnD: drop inside npc-drop-zone");
      ev.preventDefault();
      // Reuse the npcTab drop handler by dispatching a synthetic event
      // or parse here using the same logic
      try {
        const dt = ev.dataTransfer;
        const types = Array.from(dt?.types ?? []);
        const plain = dt?.getData("text/plain") || "";
        const uris = dt?.getData("text/uri-list") || "";
        const plainPreview = plain?.slice?.(0, 200) ?? "";
        pvDebug("Global Drop event types", {
          types,
          plainLen: plain.length,
          urisLen: uris.length,
          plainPreview,
        });

        let payload = null;
        if (plain) {
          try {
            payload = JSON.parse(plain);
          } catch {}
        }
        const handleActor = (actorDoc) => {
          if (!actorDoc) return false;
          if (actorDoc.documentName === "TokenDocument")
            actorDoc = actorDoc.actor;
          if (actorDoc?.documentName === "Actor") {
            if (actorDoc.type === "npc") {
              this._activeTab = "npcs";
              this._addNpc(actorDoc.id);
              return true;
            }
            ui.notifications?.warn(
              "Only NPC actors can be added to the NPC tab.",
            );
            return false;
          }
          return false;
        };
        if (payload && payload.type) {
          pvDebug("Global: Parsed JSON payload", payload);
          if (payload.type === "Actor") {
            let doc = null;
            if (payload.uuid) doc = fromUuidSync(payload.uuid);
            if (!doc && payload.id) doc = game.actors?.get(payload.id) ?? null;
            if (!handleActor(doc))
              pvWarn("Global: Actor not resolved or not NPC", payload);
            return;
          }
          if (payload.type === "Token") {
            let doc = null;
            if (payload.uuid) doc = fromUuidSync(payload.uuid);
            if (!handleActor(doc))
              pvWarn("Global: Token not resolved or no actor", payload);
            return;
          }
        }
        const uuidStr = [plain, uris].find((s) =>
          /^(Actor\.|Token\.|Compendium\.)/.test(s?.trim?.() ?? ""),
        );
        if (uuidStr) {
          pvDebug("Global: UUID-like string dropped", uuidStr);
          const doc = fromUuidSync(uuidStr.trim());
          if (!handleActor(doc))
            pvWarn("Global: UUID did not resolve to NPC Actor", uuidStr);
          return;
        }
        pvWarn("Global: Unrecognized drop payload", { types, plain, uris });
      } catch (e) {
        pvWarn("Global: Failed handling drop", e);
      }
    };

    document.addEventListener("dragover", onDocDragOver, true);
    document.addEventListener("drop", onDocDrop, true);

    // Clean-up when application closes
    this.once?.("close", () => {
      document.removeEventListener("dragover", onDocDragOver, true);
      document.removeEventListener("drop", onDocDrop, true);
      this._globalDnDActive = false;
      pvDebug("Global DnD fallback removed");
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

Hooks.on("renderPartySummaryApp", (app, html) => {
  const partySummary =
    html[0]?.querySelector?.(".party-summary") ||
    html.querySelector?.(".party-summary");
  if (partySummary) {
    pvDebug("renderPartySummaryApp: delegating click handlers");
    // Ensure DnD is wired even if activateListeners isn't called by ApplicationV2
    try {
      const npcTab = partySummary.querySelector('[data-tab="npcs"]');
      if (npcTab) {
        pvDebug("render hook: enabling DnD on npcTab");
        app._setupNpcDragDrop(npcTab);
        // Also set up a document-level fallback to capture drops by screen position
        app._setupGlobalDnD(npcTab);
      } else {
        pvWarn("render hook: npcTab not found");
      }
      // Allow dragging from our own PC cards as a controlled payload source
      partySummary.addEventListener(
        "dragstart",
        (ev) => {
          const li = ev.target?.closest?.(
            ".party-card[draggable][data-actor-id]",
          );
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
            pvDebug("dragstart(render hook): set payload", {
              id: actor.id,
              uuid: actor.uuid,
              type: actor.type,
            });
          } catch (e) {
            pvWarn("dragstart(render hook): failed to set payload", e);
          }
        },
        { capture: true },
      );
    } catch (e) {
      pvWarn("render hook: error wiring DnD", e);
    }
    // Restore active tab on render
    try {
      const desired = app._activeTab || "players";
      const tabs = partySummary.querySelectorAll(".party-tabs .tab-btn");
      const contents = partySummary.querySelectorAll(".tab-content");
      tabs.forEach((b) =>
        b.classList.toggle("active", b.dataset.tab === desired),
      );
      contents.forEach((c) => {
        c.style.display = c.dataset.tab === desired ? "block" : "none";
      });
      pvDebug("restore active tab", { tab: desired });
    } catch (e) {
      pvWarn("failed restoring active tab", e);
    }
    partySummary.addEventListener("click", (ev) => {
      // Handle remove button for NPC cards first to avoid opening the sheet
      if (ev.target.closest(".remove-npc-btn")) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const card = ev.target.closest(".party-card");
        if (!card) return;
        const id = card.dataset.actorId;
        // Suppress subsequent card click once remove completes
        app._suppressCardClick = true;
        app._removeNpc(id);
        setTimeout(() => (app._suppressCardClick = false), 300);
        return;
      }
      const tabBtn = ev.target.closest(".tab-btn");
      if (tabBtn) {
        const tab = tabBtn.dataset.tab;
        pvDebug("Tab click", { tab });
        app._activeTab = tab;
        const tabs = partySummary.querySelectorAll(".party-tabs .tab-btn");
        const contents = partySummary.querySelectorAll(".tab-content");
        tabs.forEach((b) => b.classList.toggle("active", b === tabBtn));
        contents.forEach((c) => {
          c.style.display = c.dataset.tab === tab ? "block" : "none";
        });
        return;
      }
      // Ignore clicks on buttons inside cards
      if (ev.target.closest(".remove-npc-btn, button")) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      // If a remove just happened, suppress opening the sheet
      if (app._suppressCardClick) {
        pvDebug("Suppressed card click after remove (delegated)");
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      const card = ev.target.closest(".party-card");
      if (!card) return;
      const id = card.dataset.actorId;
      const actor = game.actors?.get(id);
      pvDebug("Card clicked", {
        id,
        hasActor: !!actor,
        hasSheet: !!actor?.sheet,
      });
      if (actor?.sheet) actor.sheet.render(true);
    });
  } else {
    pvWarn("renderPartySummaryApp: .party-summary root not found in HTML");
  }
});

/** Inject the Party Summary button into the Actors directory header */
Hooks.on("renderActorDirectory", (app, html) => {
  try {
    const root =
      html instanceof HTMLElement
        ? html
        : html?.[0] instanceof HTMLElement
          ? html[0]
          : null;
    if (!root) return;
    if (root.querySelector(".party-summary-btn")) {
      pvDebug("renderActorDirectory: Party Summary button already present");
      return;
    }

    const container =
      root.querySelector(
        ".directory-header, header.directory-header, .header-actions",
      ) ?? root;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "party-summary-btn";
    const label =
      globalThis.game?.i18n?.localize("PARTYVIEW.Title") || "Party Summary";
    btn.innerHTML = `<i class="fa-solid fa-users"></i> ${label}`;
    btn.addEventListener("click", () => new PartySummaryApp().render(true));

    const actions = container.querySelector(
      "a.header-control, .header-actions",
    );
    if (actions && actions.parentElement)
      actions.parentElement.insertBefore(btn, actions);
    else container.prepend(btn);

    pvDebug("renderActorDirectory: Injected Party Summary button");
  } catch (err) {
    pvError("failed to inject button", err);
  }
});

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
