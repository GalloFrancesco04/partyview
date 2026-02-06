import { getProp, formatAbbrev, pvDebug } from "../core/utils.js";
import { getNpcSelection } from "../npc/npcSelection.js";

export function buildPartySummaryContext({ activeTab } = {}) {
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
        getProp(a, "system.currency") || getProp(a, "system.currencies") || {};
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

      let legendaryActions = undefined;
      const laMax = getProp(a, "system.resources.legact.max");
      const laVal = getProp(a, "system.resources.legact.value");
      if (Number.isFinite(laMax)) legendaryActions = Number(laMax);
      else if (Number.isFinite(laVal)) legendaryActions = Number(laVal);

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

  const npcDocs = npcIds
    .map((id) => {
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
  const resolvedTab = activeTab || "players";

  debug("_prepareContext: complete", {
    actors: rows.length,
    npcs: npcs.length,
    showIcons,
    isGM,
    allowPlayersView,
    canViewSummary,
    activeTab: resolvedTab,
  });

  return {
    actors: rows,
    showIcons,
    isGM,
    allowPlayersView,
    canViewSummary,
    npcs,
    selectedNpcIds: npcIds,
    activeTab: resolvedTab,
  };
}
