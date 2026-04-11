/**
 * DOM for Vertical Slice v12 bounded episodes — thin view over pure model output.
 */

import type { BoundedEpisodeV0, BoundedSceneEpisodesV0 } from "./boundedEpisodes.js";
import { VERTICAL_SLICE_V31_EPISODES_EMPTY_OVERVIEW } from "../app/verticalSliceV0.js";

export interface RenderBoundedEpisodesOptions {
  /** Prefix for `data-testid` attributes (`replay` / `live`). */
  testIdPrefix: "replay" | "live";
  selectedEpisodeId: string | null;
  onSelectEpisode: (nextSelectedId: string | null, episode: BoundedEpisodeV0) => void;
  surface?: "overview" | "technical";
}

export function renderBoundedEpisodesInto(
  container: HTMLElement,
  pack: BoundedSceneEpisodesV0,
  options: RenderBoundedEpisodesOptions,
): void {
  container.replaceChildren();

  const surface = options.surface ?? "technical";

  if (surface === "overview" && pack.episodes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "glass-bounded-episodes-empty-overview";
    empty.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-empty-overview`);
    empty.textContent = VERTICAL_SLICE_V31_EPISODES_EMPTY_OVERVIEW;
    container.appendChild(empty);
    return;
  }

  const tech = document.createElement("details");
  tech.className = "glass-trust-technical glass-surface-technical-only";
  tech.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-technical`);
  const techSum = document.createElement("summary");
  techSum.className = "glass-trust-technical-summary";
  techSum.textContent = "Exact story-card rules";
  const hon = document.createElement("p");
  hon.className = "glass-bounded-episodes-honesty";
  hon.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-honesty`);
  hon.textContent = pack.honestyLine;
  tech.append(techSum, hon);

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

  if (surface === "technical") {
    const lead = document.createElement("p");
    lead.className = "glass-bounded-episodes-lead";
    lead.setAttribute("data-testid", `${options.testIdPrefix}-bounded-episodes-lead`);
    lead.textContent = pack.honestyLineSimple;
    container.append(lead, tech, row);
  } else {
    container.append(tech, row);
  }
}
