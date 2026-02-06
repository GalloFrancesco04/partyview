import { pvDebug } from "../core/utils.js";
import { getNpcSelection, setNpcSelection } from "./npcSelection.js";

export async function addNpcToSelection(app, actorId) {
  const current = getNpcSelection();
  if (!current.includes(actorId)) {
    const updated = [...current, actorId];
    pvDebug("Adding NPC", { actorId, count: updated.length });
    await setNpcSelection(updated);
    app._activeTab = "npcs";
    app.render(true);
  }
}

export async function removeNpcFromSelection(app, actorId) {
  const current = getNpcSelection();
  const updated = current.filter((id) => id !== actorId);
  pvDebug("Removing NPC", { actorId, count: updated.length });
  await setNpcSelection(updated);
  app.render(true);
}
