import { pvDebug } from "../core/utils.js";

export function registerNpcSelectionSettings() {
  game.settings.register("partyview", "npcSelection", {
    name: "NPC Selection",
    scope: "world",
    config: false,
    type: String,
    default: "[]",
  });
  game.settings.register("partyview", "npcSelectionClient", {
    name: "NPC Selection (Client)",
    scope: "client",
    config: false,
    type: String,
    default: "[]",
  });
}

export function getNpcSelection() {
  const fromWorld = game.settings?.get("partyview", "npcSelection") ?? "[]";
  const fromClient =
    game.settings?.get("partyview", "npcSelectionClient") ?? "[]";
  const parse = (s) => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const w = parse(fromWorld);
  const c = parse(fromClient);
  const chosen = w.length ? w : c;
  pvDebug("getNpcSelection", { world: w, client: c, chosen });
  return chosen;
}

export async function setNpcSelection(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (game.user?.isGM) {
    pvDebug("setNpcSelection: saving to world", { count: unique.length });
    await game.settings?.set(
      "partyview",
      "npcSelection",
      JSON.stringify(unique),
    );
  } else {
    pvDebug("setNpcSelection: saving to client", { count: unique.length });
    await game.settings?.set(
      "partyview",
      "npcSelectionClient",
      JSON.stringify(unique),
    );
  }
  pvDebug("setNpcSelection: done", {
    world: game.settings?.get("partyview", "npcSelection"),
    client: game.settings?.get("partyview", "npcSelectionClient"),
  });
}

export function openNpcSelector(appInstance) {
  const allNpcs = (game.actors?.filter?.((a) => a.type === "npc") ?? []).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  const selected = new Set(getNpcSelection());
  pvDebug("openNpcSelector: opening", {
    totalNpcs: allNpcs.length,
    selected: selected.size,
  });

  const contentRoot = document.createElement("div");
  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "auto 1fr";
  list.style.gap = "6px 8px";
  list.style.maxHeight = "50vh";
  list.style.overflow = "auto";

  for (const a of allNpcs) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = a.id;
    cb.checked = selected.has(a.id);
    const label = document.createElement("label");
    label.textContent = a.name;
    label.htmlFor = `npc-${a.id}`;
    cb.id = `npc-${a.id}`;
    list.append(cb, label);
  }
  contentRoot.append(list);

  const DV2 = foundry?.applications?.api?.DialogV2;
  if (DV2) {
    const dialog = new DV2({
      window: { title: "Select NPCs" },
      content: contentRoot,
      buttons: [
        { action: "cancel", label: "Cancel" },
        { action: "ok", label: "Save", default: true },
      ],
      submit: async (ev, actionArg) => {
        const actionName =
          ev?.submitter?.dataset?.action ??
          (typeof actionArg === "string" ? actionArg : actionArg?.action) ??
          "";
        if (actionName === "ok") {
          const ids = Array.from(
            contentRoot.querySelectorAll('input[type="checkbox"]:checked'),
          ).map((i) => i.value);
          pvDebug("DialogV2 submit", { action: actionName, count: ids.length });
          await setNpcSelection(ids);
          appInstance?.render(true);
        } else {
          pvDebug("DialogV2 submit", {
            action: actionName,
            detail: { actionArgType: typeof actionArg },
          });
        }
      },
    });
    dialog.render(true);
  } else if (window.Dialog) {
    new Dialog({
      title: "Select NPCs",
      content: contentRoot.outerHTML,
      buttons: {
        cancel: { label: "Cancel" },
        ok: {
          label: "Save",
          callback: async (html) => {
            const ids = Array.from(
              html[0].querySelectorAll('input[type="checkbox"]:checked'),
            ).map((i) => i.value);
            pvDebug("Dialog (legacy) ok", { count: ids.length });
            await setNpcSelection(ids);
            appInstance?.render(true);
          },
        },
      },
      default: "ok",
    }).render(true);
  }
}
