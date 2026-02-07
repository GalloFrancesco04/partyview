import { pvDebug } from "../core/utils.js";
import { getNpcSelection } from "../npc/npcSelection.js";

function getActivePartySummaryApp() {
  return globalThis.__partyview?.partySummaryApp || null;
}

function refreshOpenPartySummaryApps(PartySummaryApp) {
  const activeApp = getActivePartySummaryApp();
  if (activeApp && activeApp.render instanceof Function) {
    activeApp.render(true, { force: true });
    return;
  }

  Object.values(ui.windows).forEach((app) => {
    if (app instanceof PartySummaryApp) {
      app.render(true, { force: true });
    }
  });
}

export function registerRefreshHooks(PartySummaryApp) {
  Hooks.on("updateToken", (tokenDoc) => {
    const npcIds = getNpcSelection();
    if (tokenDoc.actor && npcIds.includes(tokenDoc.actor.id)) {
      pvDebug("updateToken: refreshing Party Summary for NPC update", {
        tokenId: tokenDoc.id,
        actorId: tokenDoc.actor.id,
        actorName: tokenDoc.actor.name,
      });

      refreshOpenPartySummaryApps(PartySummaryApp);
    }
  });

  // Try both updateActor and preUpdateActor
  Hooks.on("preUpdateActor", (actorDoc, update, options, userId) => {
    const npcIds = getNpcSelection();
    const isPc = actorDoc.hasPlayerOwner && actorDoc.type === "character";
    const isSelectedNpc =
      actorDoc.type === "npc" && npcIds.includes(actorDoc.id);

    if (isPc || isSelectedNpc) {
      pvDebug("preUpdateActor: refreshing Party Summary", {
        actorId: actorDoc.id,
        actorName: actorDoc.name,
      });
      refreshOpenPartySummaryApps(PartySummaryApp);
    }
  });

  Hooks.on("updateActor", (actorDoc, update, options, userId) => {
    const npcIds = getNpcSelection();
    const isPc = actorDoc.hasPlayerOwner && actorDoc.type === "character";
    const isSelectedNpc =
      actorDoc.type === "npc" && npcIds.includes(actorDoc.id);

    if (isPc || isSelectedNpc) {
      pvDebug("updateActor: refreshing Party Summary", {
        actorId: actorDoc.id,
        actorName: actorDoc.name,
        type: actorDoc.type,
        hasPlayerOwner: actorDoc.hasPlayerOwner,
      });

      refreshOpenPartySummaryApps(PartySummaryApp);
    }
  });

  Hooks.on("updateItem", (itemDoc) => {
    if (itemDoc.parent) {
      const npcIds = getNpcSelection();
      const isPc =
        itemDoc.parent.hasPlayerOwner && itemDoc.parent.type === "character";
      const isSelectedNpc =
        itemDoc.parent.type === "npc" && npcIds.includes(itemDoc.parent.id);

      if (isPc || isSelectedNpc) {
        pvDebug("updateItem: refreshing Party Summary", {
          itemId: itemDoc.id,
          itemName: itemDoc.name,
          actorId: itemDoc.parent.id,
          actorName: itemDoc.parent.name,
        });

        refreshOpenPartySummaryApps(PartySummaryApp);
      }
    }
  });

  Hooks.on("canvasReady", () => {
    pvDebug("canvasReady: refreshing Party Summary for scene change");
    refreshOpenPartySummaryApps(PartySummaryApp);
  });
}
