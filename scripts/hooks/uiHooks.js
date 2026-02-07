import { pvDebug, pvWarn, pvError } from "../core/utils.js";
import { setupGlobalDnD, setupNpcDragDrop } from "../dragdrop/dragDrop.js";

function setActivePartySummaryApp(app) {
  globalThis.__partyview = globalThis.__partyview ?? {};
  globalThis.__partyview.partySummaryApp = app;
}

function clearActivePartySummaryApp(app) {
  if (globalThis.__partyview?.partySummaryApp === app) {
    delete globalThis.__partyview.partySummaryApp;
  }
}

export function registerUiHooks(PartySummaryApp) {
  Hooks.on("renderPartySummaryApp", (app, html) => {
    setActivePartySummaryApp(app);
    const partySummary =
      html[0]?.querySelector?.(".party-summary") ||
      html.querySelector?.(".party-summary");
    if (partySummary) {
      pvDebug("renderPartySummaryApp: delegating click handlers");
      try {
        const npcTab = partySummary.querySelector('[data-tab="npcs"]');
        if (npcTab) {
          pvDebug("render hook: enabling DnD on npcTab");
          setupNpcDragDrop(app, npcTab);
          setupGlobalDnD(app);
        } else {
          pvWarn("render hook: npcTab not found");
        }
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
        if (ev.target.closest(".remove-npc-btn")) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          const card = ev.target.closest(".party-card");
          if (!card) return;
          const id = card.dataset.actorId;
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
        if (ev.target.closest(".remove-npc-btn, button")) {
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
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
      btn.addEventListener("click", () => {
        const partyApp = new PartySummaryApp();
        setActivePartySummaryApp(partyApp);
        partyApp.render(true);
      });

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

  Hooks.on("closePartySummaryApp", (app) => {
    clearActivePartySummaryApp(app);
  });
}
