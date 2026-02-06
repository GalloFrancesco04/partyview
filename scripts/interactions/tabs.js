import { pvDebug } from "../core/utils.js";

export function setupPartyTabs(partySummary, app) {
  const tabs = partySummary.querySelectorAll(".party-tabs .tab-btn");
  const contents = partySummary.querySelectorAll(".tab-content");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      pvDebug("Tab click (direct)", { tab });
      app._activeTab = tab;
      tabs.forEach((b) => b.classList.toggle("active", b === btn));
      contents.forEach((c) => {
        c.style.display = c.dataset.tab === tab ? "block" : "none";
      });
    });
  });
}
