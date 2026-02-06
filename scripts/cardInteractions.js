import { pvDebug } from "./utils.js";

export function setupCardInteractions(partySummary, app) {
  // Use mousedown for remove button to block click propagation before card click
  partySummary.addEventListener("mousedown", (ev) => {
    if (ev.button !== 0) return; // Only left click
    if (ev.target.closest(".remove-npc-btn")) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      // Suppress any subsequent click on the card caused by this interaction
      app._suppressCardClick = true;
      const card = ev.target.closest(".party-card");
      if (!card) return;
      const id = card.dataset.actorId;
      app._removeNpc(id);
      // Clear suppression shortly after
      setTimeout(() => (app._suppressCardClick = false), 300);
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
    if (app._suppressCardClick) {
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
