import { pvDebug } from "./utils.js";
import { getNpcSelection } from "./npcSelection.js";

function refreshOpenPartySummaryApps(PartySummaryApp) {
  Object.values(ui.windows).forEach((app) => {
    if (app instanceof PartySummaryApp) {
      app.render(false);
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

  Hooks.on("updateActor", (actorDoc) => {
    const npcIds = getNpcSelection();
    if (actorDoc.type === "npc" && npcIds.includes(actorDoc.id)) {
      pvDebug("updateActor: refreshing Party Summary for NPC update", {
        actorId: actorDoc.id,
        actorName: actorDoc.name,
      });

      refreshOpenPartySummaryApps(PartySummaryApp);
    }
  });

  Hooks.on("canvasReady", () => {
    pvDebug("canvasReady: refreshing Party Summary for scene change");
    refreshOpenPartySummaryApps(PartySummaryApp);
  });
}
