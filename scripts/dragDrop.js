import { pvDebug, pvWarn } from "./utils.js";

export function setupNpcDragDrop(app, npcTab) {
  pvDebug("Setting up drag and drop for NPC tab");
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
    handleDrop(ev, app);
  });
}

export function setupGlobalDnD(app) {
  if (app._globalDnDActive) return;
  app._globalDnDActive = true;
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
    handleDrop(ev, app);
  };

  document.addEventListener("dragover", onDocDragOver, true);
  document.addEventListener("drop", onDocDrop, true);

  app.once?.("close", () => {
    document.removeEventListener("dragover", onDocDragOver, true);
    document.removeEventListener("drop", onDocDrop, true);
    app._globalDnDActive = false;
    pvDebug("Global DnD fallback removed");
  });
}

function handleDrop(ev, app) {
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
      } catch {}
    }

    const handleActor = (actorDoc) => {
      if (!actorDoc) return false;
      if (actorDoc.documentName === "TokenDocument") actorDoc = actorDoc.actor;
      if (actorDoc?.documentName === "Actor") {
        if (actorDoc.type === "npc") {
          app._activeTab = "npcs";
          app._addNpc(actorDoc.id);
          return true;
        }
        ui.notifications?.warn("Only NPC actors can be added to the NPC tab.");
        return false;
      }
      return false;
    };

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

    pvWarn("Unrecognized drop payload", { types, plain, uris });
    ui.notifications?.warn(
      "Unable to read drop data. Please drag from the Actors directory or a UUID link.",
    );
  } catch (err) {
    pvWarn("Failed to parse drop data", err);
  }
}
