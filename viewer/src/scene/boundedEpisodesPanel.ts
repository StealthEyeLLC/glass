/**
 * DOM for Vertical Slice v12 bounded episodes — thin view over pure model output.
 */

import type { BoundedEpisodeV0, BoundedSceneEpisodesV0 } from "./boundedEpisodes.js";

export interface RenderBoundedEpisodesOptions {
  /** Prefix for `data-testid` attributes (`replay` / `live`). */
  testIdPrefix: "replay" | "live";
  selectedEpisodeId: string | null;
  onSelectEpisode: (nextSelectedId: string | null, episode: BoundedEpisodeV0) => void;
}

export function renderBoundedEpisodesInto(
  container: HTMLElement,
  pack: BoundedSceneEpisodesV0,
  options: RenderBoundedEpisodesOptions,
): void {
  container.replaceChildren();

  const hon = document.createElement("p");
  hon.className = "glass-bounded-episodes-honesty";
  hon.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-honesty`);
  hon.textContent = pack.honestyLine;

  const row = document.createElement("div");
  row.className = "glass-bounded-episodes-row";
  row.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-row`);

  for (const ep of pack.episodes) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "glass-bounded-episode-card";
    if (ep.isPrimary) {
      card.classList.add("glass-bounded-episode-card--primary");
    }
    if (options.selectedEpisodeId === ep.id) {
      card.classList.add("glass-bounded-episode-card--selected");
    }
    card.dataset.episodeId = ep.id;
    card.dataset.episodeKind = ep.kind;
    card.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episode-card`);

    const title = document.createElement("span");
    title.className = "glass-bounded-episode-card-title";
    title.textContent = ep.title;

    const summary = document.createElement("span");
    summary.className = "glass-bounded-episode-card-summary";
    summary.textContent = ep.summary;

    card.append(title, summary);
    card.addEventListener("click", () => {
      const next = options.selectedEpisodeId === ep.id ? null : ep.id;
      options.onSelectEpisode(next, ep);
    });
    row.appendChild(card);
  }

  container.append(hon, row);
}
