const button = document.getElementById("loadMatches");
const upcomingButton = document.getElementById("loadUpcoming");
const refreshLiveButton = document.getElementById("refreshLive");
const clearSearchButton = document.getElementById("clearSearch");
const installBtn = document.getElementById("installApp");

const matchesDiv = document.getElementById("matches");
const upcomingDiv = document.getElementById("upcomingMatches");
const matchTypeFilter = document.getElementById("matchTypeFilter");
const seriesFilter = document.getElementById("seriesFilter");
const searchInput = document.getElementById("searchTeam");
const message = document.getElementById("message");
const lastUpdated = document.getElementById("lastUpdated");
const themeToggle = document.getElementById("themeToggle");

const matchModal = document.getElementById("matchModal");
const modalBody = document.getElementById("modalBody");
const closeModal = document.getElementById("closeModal");

const liveCount = document.getElementById("liveCount");
const upcomingCount = document.getElementById("upcomingCount");
const searchCount = document.getElementById("searchCount");

const API_KEY = "2668d747-961c-47dc-94bf-e75d419e8baf";

const LIVE_API_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${API_KEY}&offset=0`;
const UPCOMING_API_URL = `https://api.cricapi.com/v1/cricScore?apikey=${API_KEY}`;
const MATCH_INFO_API_URL = `https://api.cricapi.com/v1/match_info?apikey=${API_KEY}&id=`;
const COMMENTARY_API_URL = `https://api.cricapi.com/v1/match_commentary?apikey=${API_KEY}&id=`;

let liveMatchesCache = [];
let upcomingMatchesCache = [];
let liveRefreshInterval = null;
let modalRefreshInterval = null;
let isLoadingLive = false;
let isLoadingUpcoming = false;
let currentOpenMatch = null;
let deferredPrompt = null;

const STORAGE_KEYS = {
  theme: "gts_theme",
  liveMatches: "gts_live_matches",
  upcomingMatches: "gts_upcoming_matches",
  lastUpdated: "gts_last_updated"
};

const FALLBACK_LOGO = "https://img.icons8.com/color/96/trophy.png";

const flagMap = {
  india: "https://flagcdn.com/w80/in.png",
  australia: "https://flagcdn.com/w80/au.png",
  england: "https://flagcdn.com/w80/gb.png",
  pakistan: "https://flagcdn.com/w80/pk.png",
  "south africa": "https://flagcdn.com/w80/za.png",
  "new zealand": "https://flagcdn.com/w80/nz.png",
  "sri lanka": "https://flagcdn.com/w80/lk.png",
  bangladesh: "https://flagcdn.com/w80/bd.png",
  afghanistan: "https://flagcdn.com/w80/af.png",
  ireland: "https://flagcdn.com/w80/ie.png",
  zimbabwe: "https://flagcdn.com/w80/zw.png",
  "west indies": "https://flagcdn.com/w80/jm.png"
};

const DEMO_LIVE_MATCHES = [
  {
    id: "demo-live-1",
    team1: "India",
    team2: "Australia",
    teams: "India vs Australia",
    logo1: getTeamLogo("india"),
    logo2: getTeamLogo("australia"),
    score: "India 182/5 (19.2 ov)",
    status: "India need 12 runs in 4 balls",
    series: "GTS Demo T20 Series",
    venue: "Mumbai",
    date: new Date().toLocaleString(),
    matchType: "t20",
    isLive: true
  },
  {
    id: "demo-live-2",
    team1: "England",
    team2: "Pakistan",
    teams: "England vs Pakistan",
    logo1: getTeamLogo("england"),
    logo2: getTeamLogo("pakistan"),
    score: "England: 182/5 (19.2 ov) | Pakistan: 170/7 (20 ov)",
    status: "Pakistan trail by 22 runs",
    series: "GTS Demo Clash",
    venue: "Lahore",
    date: new Date().toLocaleString(),
    matchType: "t20",
    isLive: true
  }
];

const DEMO_UPCOMING_MATCHES = [
  {
    id: "demo-upcoming-1",
    team1: "South Africa",
    team2: "New Zealand",
    teams: "South Africa vs New Zealand",
    logo1: getTeamLogo("south africa"),
    logo2: getTeamLogo("new zealand"),
    score: new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString(),
    status: "Upcoming Match",
    series: "GTS Demo ODI Cup",
    venue: "Cape Town",
    date: new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString(),
    matchType: "odi",
    isLive: false
  },
  {
    id: "demo-upcoming-2",
    team1: "Sri Lanka",
    team2: "Bangladesh",
    teams: "Sri Lanka vs Bangladesh",
    logo1: getTeamLogo("sri lanka"),
    logo2: getTeamLogo("bangladesh"),
    score: new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleString(),
    status: "Upcoming Match",
    series: "GTS Demo League",
    venue: "Colombo",
    date: new Date(Date.now() + 8 * 60 * 60 * 1000).toLocaleString(),
    matchType: "odi",
    isLive: false
  }
];

function setMessage(text) {
  message.textContent = text;
}

function updateTimestamp(customText = null) {
  const text = customText || `Last updated: ${new Date().toLocaleString()}`;
  lastUpdated.textContent = text;
  localStorage.setItem(STORAGE_KEYS.lastUpdated, text);
}

function showLoading(targetDiv, text) {
  targetDiv.innerHTML = `
    <div class="loading-box">
      <div class="spinner"></div>
      <p>${text}</p>
    </div>
  `;
}

function showEmpty(targetDiv, text) {
  targetDiv.innerHTML = `<p class="empty-message">${text}</p>`;
}

function safeText(value, fallback = "N/A") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(dateValue) {
  if (!dateValue) return "Date not available";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleString();
}

function escapeHtml(value) {
  return safeText(value, "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return map[char];
  });
}

function getTeamLogo(teamName) {
  if (!teamName) return FALLBACK_LOGO;
  const lower = teamName.toLowerCase();
  for (const key in flagMap) {
    if (lower.includes(key)) return flagMap[key];
  }
  return FALLBACK_LOGO;
}

function saveMatchesToStorage() {
  localStorage.setItem(STORAGE_KEYS.liveMatches, JSON.stringify(liveMatchesCache));
  localStorage.setItem(STORAGE_KEYS.upcomingMatches, JSON.stringify(upcomingMatchesCache));
}

function loadMatchesFromStorage() {
  try {
    const savedLive = JSON.parse(localStorage.getItem(STORAGE_KEYS.liveMatches) || "[]");
    const savedUpcoming = JSON.parse(localStorage.getItem(STORAGE_KEYS.upcomingMatches) || "[]");
    const savedTime = localStorage.getItem(STORAGE_KEYS.lastUpdated);

    if (Array.isArray(savedLive) && savedLive.length) liveMatchesCache = savedLive;
    if (Array.isArray(savedUpcoming) && savedUpcoming.length) upcomingMatchesCache = savedUpcoming;
    if (savedTime) updateTimestamp(savedTime);
  } catch (error) {
    console.error("Storage parse error:", error);
  }
}

function useDemoLiveData(messageText = "API limit reached. Showing demo live data.") {
  liveMatchesCache = DEMO_LIVE_MATCHES;
  populateSeriesFilter();
  filterAndDisplayLiveMatches();
  updateCounters();
  updateTimestamp();
  setMessage(messageText);
  saveMatchesToStorage();
}

function useDemoUpcomingData(messageText = "API unavailable. Showing demo upcoming matches.") {
  upcomingMatchesCache = DEMO_UPCOMING_MATCHES;
  populateSeriesFilter();
  filterAndDisplayUpcomingMatches();
  updateCounters();
  updateTimestamp();
  setMessage(messageText);
  saveMatchesToStorage();
}

function useSavedLiveData(messageText = "Showing saved live matches.") {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.liveMatches) || "[]");
  if (Array.isArray(saved) && saved.length) {
    liveMatchesCache = saved;
    populateSeriesFilter();
    filterAndDisplayLiveMatches();
    updateCounters();
    setMessage(messageText);
    return true;
  }
  return false;
}

function useSavedUpcomingData(messageText = "Showing saved upcoming matches.") {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.upcomingMatches) || "[]");
  if (Array.isArray(saved) && saved.length) {
    upcomingMatchesCache = saved;
    populateSeriesFilter();
    filterAndDisplayUpcomingMatches();
    updateCounters();
    setMessage(messageText);
    return true;
  }
  return false;
}

function getMatchStateFromStatus(statusText, isLiveFlag = false) {
  const text = safeText(statusText, "").toLowerCase();

  const isResult =
    text.includes("won") ||
    text.includes("result") ||
    text.includes("completed") ||
    text.includes("match over") ||
    text.includes("stumps") ||
    text.includes("draw") ||
    text.includes("tie");

  const isUpcoming =
    text.includes("upcoming") ||
    text.includes("not started") ||
    text.includes("starts at") ||
    text.includes("scheduled") ||
    text.includes("fixture") ||
    text.includes("yet to begin");

  const isLive =
    !isResult &&
    (
      isLiveFlag ||
      text.includes("live") ||
      text.includes("in progress") ||
      text.includes("innings break") ||
      text.includes("drinks") ||
      text.includes("day") ||
      text.includes("session") ||
      text.includes("need") ||
      text.includes("trail")
    );

  if (isResult) return "result";
  if (isUpcoming) return "upcoming";
  if (isLive) return "live";
  return isLiveFlag ? "live" : "upcoming";
}

function getStatusBadgeHtml(statusText, isLiveFlag = false) {
  const state = getMatchStateFromStatus(statusText, isLiveFlag);

  if (state === "live") {
    return `
      <div class="live-pill">
        <span class="live-pulse"></span>
        LIVE
      </div>
    `;
  }

  if (state === "result") {
    return `<div class="result-pill">RESULT</div>`;
  }

  return `<div class="upcoming-pill">UPCOMING</div>`;
}

function getCardFooterBadge(match) {
  const state = getMatchStateFromStatus(match.status, match.isLive);
  if (state === "live") return "Live Match";
  if (state === "result") return "Result";
  return "Upcoming Match";
}

function getUniqueSeriesNames() {
  const allMatches = [...liveMatchesCache, ...upcomingMatchesCache];
  return [
    ...new Set(
      allMatches
        .map((match) => safeText(match.series, "").trim())
        .filter((series) => series && series.toLowerCase() !== "n/a")
    )
  ].sort((a, b) => a.localeCompare(b));
}

function populateSeriesFilter() {
  const currentValue = seriesFilter.value;
  const uniqueSeries = getUniqueSeriesNames();

  seriesFilter.innerHTML = `<option value="">All Series</option>`;
  uniqueSeries.forEach((series) => {
    seriesFilter.innerHTML += `<option value="${series.toLowerCase()}">${series}</option>`;
  });

  const stillExists = uniqueSeries.some((series) => series.toLowerCase() === currentValue);
  seriesFilter.value = stillExists ? currentValue : "";
}

function getFilteredMatches(matchList) {
  const searchValue = searchInput.value.toLowerCase().trim();
  const typeValue = matchTypeFilter.value.toLowerCase().trim();
  const seriesValue = seriesFilter.value.toLowerCase().trim();

  return matchList.filter((match) => {
    const teams = safeText(match.teams, "").toLowerCase();
    const matchType = safeText(match.matchType, "").toLowerCase();
    const series = safeText(match.series, "").toLowerCase();

    const teamMatch = !searchValue || teams.includes(searchValue);
    const typeMatch = !typeValue || matchType === typeValue;
    const seriesMatch = !seriesValue || series === seriesValue;

    return teamMatch && typeMatch && seriesMatch;
  });
}

function updateCounters() {
  const filteredLive = getFilteredMatches(liveMatchesCache);
  const filteredUpcoming = getFilteredMatches(upcomingMatchesCache);

  liveCount.textContent = filteredLive.length;
  upcomingCount.textContent = filteredUpcoming.length;
  searchCount.textContent = filteredLive.length + filteredUpcoming.length;
}

function formatOneInningsLine(inning) {
  if (!inning) return "Score not available";
  const name = safeText(inning.inning, "Innings");
  const runs = safeText(inning.r, "-");
  const wickets = safeText(inning.w, "-");
  const overs = safeText(inning.o, "-");
  return `${name}: ${runs}/${wickets} (${overs} ov)`;
}

function formatScoreLines(scoreArray) {
  if (!Array.isArray(scoreArray) || !scoreArray.length) {
    return safeText(currentOpenMatch?.score, "Score not available");
  }
  return scoreArray.map(formatOneInningsLine).join(" | ");
}

function getFirstInningsRuns(match) {
  if (!match || !match.score) return 0;
  const scoreText = String(match.score || "");
  const firstRunsMatch = scoreText.match(/(\d+)\/\d+/);
  return firstRunsMatch ? Number(firstRunsMatch[1]) : 0;
}

function getProgressWidth(match) {
  const runs = getFirstInningsRuns(match);
  if (!runs) return 0;

  const type = String(match.matchType || "").toLowerCase();
  let maxRuns = 400;

  if (type === "t20") maxRuns = 250;
  else if (type === "odi") maxRuns = 400;
  else if (type === "test") maxRuns = 500;

  return Math.min((runs / maxRuns) * 100, 100);
}

function getProgressBarHtml(match) {
  const state = getMatchStateFromStatus(match.status, match.isLive);
  if (state !== "live") return "";

  const progress = getProgressWidth(match);
  if (!progress) return "";

  return `
    <div class="progress-wrap">
      <div class="progress-label">Score Progress</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    </div>
  `;
}

function normalizeMatch(apiMatch, type = "live") {
  const teamInfo = Array.isArray(apiMatch.teamInfo) ? apiMatch.teamInfo : [];
  const teams = Array.isArray(apiMatch.teams) ? apiMatch.teams : [];

  const team1 = teamInfo[0]?.name || teams[0] || "Team 1";
  const team2 = teamInfo[1]?.name || teams[1] || "Team 2";

  let scoreText = "Score not available";

  if (type === "upcoming") {
    scoreText = formatDate(apiMatch.dateTimeGMT || apiMatch.date);
  } else if (Array.isArray(apiMatch.score) && apiMatch.score.length > 0) {
    scoreText = apiMatch.score.map(formatOneInningsLine).join(" | ");
  } else if (typeof apiMatch.score === "string" && apiMatch.score.trim()) {
    scoreText = apiMatch.score;
  }

  const status = apiMatch.status || (type === "upcoming" ? "Upcoming Match" : "Live");

  return {
    id: apiMatch.id || `${team1}-${team2}-${type}`,
    raw: apiMatch,
    team1,
    team2,
    teams: `${team1} vs ${team2}`,
    logo1: teamInfo[0]?.img || getTeamLogo(team1),
    logo2: teamInfo[1]?.img || getTeamLogo(team2),
    score: scoreText,
    status,
    venue: safeText(apiMatch.venue, "Venue not available"),
    series: safeText(apiMatch.series, "Series not available"),
    date: formatDate(apiMatch.dateTimeGMT || apiMatch.date),
    matchType: safeText(apiMatch.matchType, type === "upcoming" ? "odi" : "t20"),
    isLive: type === "live"
  };
}

function createMatchCard(match, type = "live") {
  const state = getMatchStateFromStatus(match.status, match.isLive);
  const cardClass = type === "live" ? "live-card" : "";
  const statusClass = state === "result" ? "status-win" : state === "live" ? "status-live" : "";

  return `
    <div class="card ${cardClass} clickable-card" data-match-id="${match.id}" data-type="${type}">
      <div class="card-top">
        <span class="match-type">${safeText(match.matchType).toUpperCase()}</span>
        ${getStatusBadgeHtml(match.status, match.isLive)}
      </div>

      <div class="teams">
        <div class="team-block">
          <img src="${match.logo1}" alt="${escapeHtml(match.team1)}" onerror="this.src='${FALLBACK_LOGO}'">
          <span class="team-name">${safeText(match.team1)}</span>
        </div>

        <span class="vs">VS</span>

        <div class="team-block">
          <img src="${match.logo2}" alt="${escapeHtml(match.team2)}" onerror="this.src='${FALLBACK_LOGO}'">
          <span class="team-name">${safeText(match.team2)}</span>
        </div>
      </div>

      <h3 class="match-title">${safeText(match.teams)}</h3>

      <div class="score-main">${safeText(match.score)}</div>

      <p class="status ${statusClass}">${safeText(match.status)}</p>

      <div class="card-meta">
        <span>${safeText(match.series)}</span>
        <span>${safeText(match.venue)}</span>
        <span>${safeText(match.date)}</span>
      </div>

      ${getProgressBarHtml(match)}

      <div class="card-footer">
        <span class="live-badge">${getCardFooterBadge(match)}</span>
      </div>
    </div>
  `;
}

function attachCardClickEvents() {
  const cards = document.querySelectorAll(".clickable-card");

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const matchId = card.dataset.matchId;
      const type = card.dataset.type;
      const sourceList = type === "live" ? liveMatchesCache : upcomingMatchesCache;
      const selectedMatch = sourceList.find((match) => String(match.id) === String(matchId));

      if (selectedMatch) openMatchModal(selectedMatch);
    });
  });
}

function displayMatches(matchList, targetDiv, type = "live") {
  if (!matchList || matchList.length === 0) {
    showEmpty(targetDiv, `No ${type} matches found.`);
    return;
  }

  targetDiv.innerHTML = matchList.map((match) => createMatchCard(match, type)).join("");
  attachCardClickEvents();
}

function filterAndDisplayLiveMatches() {
  const filtered = getFilteredMatches(liveMatchesCache);
  displayMatches(filtered, matchesDiv, "live");
}

function filterAndDisplayUpcomingMatches() {
  const filtered = getFilteredMatches(upcomingMatchesCache);
  displayMatches(filtered, upcomingDiv, "upcoming");
}

function normalizeCommentaryItem(item, index = 0) {
  const over =
    item?.over ??
    item?.ball ??
    item?.overNumber ??
    item?.inningBall ??
    item?.id ??
    index + 1;

  const text =
    item?.commentary ||
    item?.text ||
    item?.event ||
    item?.description ||
    item?.msg ||
    "Update not available";

  const lower = safeText(text, "").toLowerCase();

  let badge = "UPDATE";
  let badgeClass = "commentary-badge-update";

  if (lower.includes("wicket") || lower.includes("out")) {
    badge = "WICKET";
    badgeClass = "commentary-badge-wicket";
  } else if (lower.includes("six")) {
    badge = "SIX";
    badgeClass = "commentary-badge-six";
  } else if (lower.includes("four")) {
    badge = "FOUR";
    badgeClass = "commentary-badge-four";
  } else if (lower.includes("dot")) {
    badge = "DOT";
    badgeClass = "commentary-badge-dot";
  } else if (lower.includes("1 run") || lower.includes("single")) {
    badge = "1";
    badgeClass = "commentary-badge-run";
  } else if (lower.includes("2 run")) {
    badge = "2";
    badgeClass = "commentary-badge-run";
  } else if (lower.includes("3 run")) {
    badge = "3";
    badgeClass = "commentary-badge-run";
  } else if (lower.includes("wide")) {
    badge = "WD";
    badgeClass = "commentary-badge-extra";
  } else if (lower.includes("no ball")) {
    badge = "NB";
    badgeClass = "commentary-badge-extra";
  } else if (lower.includes("over")) {
    badge = "OVER";
    badgeClass = "commentary-badge-update";
  }

  return {
    over: safeText(over, "-"),
    text: safeText(text, "Update not available"),
    badge,
    badgeClass
  };
}

function getRecentOversFromCommentary(commentary) {
  if (!Array.isArray(commentary) || !commentary.length) return [];
  return commentary.slice(0, 10).map(normalizeCommentaryItem);
}

function renderRecentOvers(commentary) {
  const recent = getRecentOversFromCommentary(commentary);
  if (!recent.length) {
    return `<p class="empty-message">Recent updates not available.</p>`;
  }

  return `
    <div class="score-section">
      <h3>Recent Updates</h3>
      <div class="commentary-list">
        ${recent.map((item) => `
          <div class="commentary-item">
            <div class="commentary-over">${safeText(item.over, "-")}</div>
            <div class="commentary-main">
              <div class="commentary-topline">
                <span class="commentary-badge ${item.badgeClass}">${item.badge}</span>
              </div>
              <div class="commentary-text">${safeText(item.text)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRealCommentary(commentaryData) {
  if (!Array.isArray(commentaryData) || !commentaryData.length) {
    return `<p class="empty-message">No ball-by-ball commentary available.</p>`;
  }

  return commentaryData
    .map((item, index) => normalizeCommentaryItem(item, index))
    .map((ball) => `
      <div class="commentary-item">
        <div class="commentary-over">${safeText(ball.over, "-")}</div>
        <div class="commentary-main">
          <div class="commentary-topline">
            <span class="commentary-badge ${ball.badgeClass}">${ball.badge}</span>
          </div>
          <div class="commentary-text">${safeText(ball.text, "Update not available")}</div>
        </div>
      </div>
    `)
    .join("");
}

function normalizeBattingEntry(item) {
  if (!item || typeof item !== "object") return null;

  return {
    name: item.name || item.player || item.batsman || item.batter || "-",
    runs: item.runs ?? item.r ?? "-",
    balls: item.balls ?? item.b ?? "-",
    fours: item.fours ?? item["4s"] ?? "-",
    sixes: item.sixes ?? item["6s"] ?? "-",
    strikeRate: item.strikeRate ?? item.sr ?? "-"
  };
}

function normalizeBowlingEntry(item) {
  if (!item || typeof item !== "object") return null;

  return {
    name: item.name || item.player || item.bowler || "-",
    overs: item.overs ?? item.o ?? "-",
    maidens: item.maidens ?? item.m ?? "-",
    runs: item.runs ?? item.r ?? "-",
    wickets: item.wickets ?? item.w ?? "-",
    economy: item.economy ?? item.eco ?? item.econ ?? "-"
  };
}

function extractCurrentPlayers(details) {
  const batting = Array.isArray(details?.batting)
    ? details.batting.map(normalizeBattingEntry).filter(Boolean)
    : [];

  const bowling = Array.isArray(details?.bowling)
    ? details.bowling.map(normalizeBowlingEntry).filter(Boolean)
    : [];

  return {
    batters: batting.slice(0, 2),
    bowler: bowling[0] || null
  };
}

function renderCurrentPlayers(details) {
  const players = extractCurrentPlayers(details);
  const batter1 = players.batters[0];
  const batter2 = players.batters[1];
  const bowler = players.bowler;

  return `
    <div class="summary-grid" style="margin-top:18px;">
      <div class="info-box">
        <h4>Current Batters</h4>
        ${
          batter1
            ? `
              <div class="player-line">
                <strong>★ ${safeText(batter1.name)}</strong>
                <span>${safeText(batter1.runs, "-")} (${safeText(batter1.balls, "-")})</span>
              </div>
              <div class="player-subline">4s ${safeText(batter1.fours, "-")} • 6s ${safeText(batter1.sixes, "-")} • SR ${safeText(batter1.strikeRate, "-")}</div>
            `
            : `<p>Current batter not available</p>`
        }

        ${
          batter2
            ? `
              <div class="player-line" style="margin-top:10px;">
                <strong>${safeText(batter2.name)}</strong>
                <span>${safeText(batter2.runs, "-")} (${safeText(batter2.balls, "-")})</span>
              </div>
              <div class="player-subline">4s ${safeText(batter2.fours, "-")} • 6s ${safeText(batter2.sixes, "-")} • SR ${safeText(batter2.strikeRate, "-")}</div>
            `
            : `<p>Non-striker not available</p>`
        }
      </div>

      <div class="info-box">
        <h4>Current Bowler</h4>
        ${
          bowler
            ? `
              <div class="player-line">
                <strong>${safeText(bowler.name)}</strong>
                <span>${safeText(bowler.overs, "-")} ov</span>
              </div>
              <div class="player-subline">
                M ${safeText(bowler.maidens, "-")} • R ${safeText(bowler.runs, "-")} • W ${safeText(bowler.wickets, "-")} • Econ ${safeText(bowler.economy, "-")}
              </div>
            `
            : `<p>Current bowler not available</p>`
        }
      </div>
    </div>
  `;
}

function renderInningsCards(scoreArray) {
  if (!Array.isArray(scoreArray) || !scoreArray.length) {
    return `<p class="empty-message">Innings breakdown not available.</p>`;
  }

  return `
    <div class="summary-grid" style="margin-top:18px;">
      ${scoreArray.map((inning) => `
        <div class="info-box innings-box">
          <h4>${safeText(inning.inning, "Innings")}</h4>
          <div class="innings-big-score">${safeText(inning.r, "-")}/${safeText(inning.w, "-")}</div>
          <div class="innings-subline">${safeText(inning.o, "-")} overs</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSummaryTab(match) {
  const state = getMatchStateFromStatus(match.status, match.isLive);
  const statusClass = state === "result" ? "status-win" : state === "live" ? "status-live" : "";

  return `
    <h2 class="modal-title">${safeText(match.teams)}</h2>

    <div class="modal-teams">
      <div class="modal-team">
        <img src="${match.logo1}" alt="${escapeHtml(match.team1)}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team1)}</span>
      </div>

      <span class="modal-vs">VS</span>

      <div class="modal-team">
        <img src="${match.logo2}" alt="${escapeHtml(match.team2)}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team2)}</span>
      </div>
    </div>

    <div style="display:flex;justify-content:center;">
      ${getStatusBadgeHtml(match.status, match.isLive)}
    </div>

    <div class="big-score-header">${safeText(match.score)}</div>

    <div class="summary-grid">
      <div class="info-box">
        <h4>Match Info</h4>
        <p><strong>Series:</strong> ${safeText(match.series)}</p>
        <p><strong>Venue:</strong> ${safeText(match.venue)}</p>
        <p><strong>Date:</strong> ${safeText(match.date)}</p>
        <p><strong>Type:</strong> ${safeText(match.matchType)}</p>
      </div>

      <div class="info-box">
        <h4>Match Status</h4>
        <p><strong>Status:</strong> <span class="${statusClass}">${safeText(match.status)}</span></p>
      </div>
    </div>

    ${getProgressBarHtml(match)}

    <div class="player-pill-wrap">
      <div class="player-pill">${state === "live" ? "Live Tracking" : state === "result" ? "Match Result" : "Upcoming Match"}</div>
      <div class="player-pill">${safeText(match.matchType).toUpperCase()}</div>
      <div class="player-pill">${safeText(match.series, "Series")}</div>
    </div>
  `;
}

function splitStatusDetails(statusText) {
  const text = safeText(statusText, "Status not available");
  const parts = text.split(" - ");
  return {
    main: parts[0] || text,
    extra: parts.slice(1).join(" - ")
  };
}

function renderDetailedSummary(match, details, commentaryData = []) {
  const statusText = safeText(details?.status || match.status);
  const state = getMatchStateFromStatus(statusText, match.isLive);
  const statusParts = splitStatusDetails(statusText);
  const statusClass = state === "result" ? "status-win" : state === "live" ? "status-live" : "";

  const scoreLines = formatScoreLines(details?.score);
  const toss = safeText(details?.toss, "Not available");
  const winner = safeText(details?.matchWinner || details?.winner, "Not available");

  return `
    <h2 class="modal-title">${safeText(match.teams)}</h2>

    <div class="modal-teams">
      <div class="modal-team">
        <img src="${match.logo1}" alt="${escapeHtml(match.team1)}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team1)}</span>
      </div>

      <span class="modal-vs">VS</span>

      <div class="modal-team">
        <img src="${match.logo2}" alt="${escapeHtml(match.team2)}" onerror="this.src='${FALLBACK_LOGO}'">
        <span>${safeText(match.team2)}</span>
      </div>
    </div>

    <div style="display:flex;justify-content:center;">
      ${getStatusBadgeHtml(statusText, match.isLive)}
    </div>

    <div class="big-score-header">${scoreLines}</div>

    <div class="summary-grid">
      <div class="info-box">
        <h4>Match Info</h4>
        <p><strong>Series:</strong> ${safeText(details?.series || match.series)}</p>
        <p><strong>Venue:</strong> ${safeText(details?.venue || match.venue)}</p>
        <p><strong>Date:</strong> ${formatDate(details?.dateTimeGMT || details?.date || match.date)}</p>
        <p><strong>Type:</strong> ${safeText(details?.matchType || match.matchType)}</p>
      </div>

      <div class="info-box">
        <h4>Match Status</h4>
        <p><strong>Status:</strong> <span class="${statusClass}">${safeText(statusParts.main)}</span></p>
        ${statusParts.extra ? `<p><strong>Extra:</strong> ${safeText(statusParts.extra)}</p>` : ""}
        <p><strong>Toss:</strong> ${toss}</p>
        <p><strong>Winner:</strong> ${winner}</p>
      </div>
    </div>

    ${renderCurrentPlayers(details)}
    ${renderInningsCards(details?.score)}
    ${renderRecentOvers(commentaryData)}
  `;
}

function renderScorecardTab(match) {
  return `
    <div class="score-section">
      <h3>Scorecard</h3>
      <p class="empty-message">Detailed scorecard is loading for ${safeText(match.teams)}.</p>
    </div>
  `;
}

function renderRealScorecard(match, details) {
  const batting = Array.isArray(details?.batting) ? details.batting.map(normalizeBattingEntry).filter(Boolean) : [];
  const bowling = Array.isArray(details?.bowling) ? details.bowling.map(normalizeBowlingEntry).filter(Boolean) : [];
  const score = Array.isArray(details?.score) ? details.score : [];
  const teamInfo = Array.isArray(details?.teamInfo) ? details.teamInfo : [];

  const battingRows = batting.length
    ? batting.map((player) => `
        <tr>
          <td>${safeText(player.name)}</td>
          <td>${safeText(player.runs, "-")}</td>
          <td>${safeText(player.balls, "-")}</td>
          <td>${safeText(player.fours, "-")}</td>
          <td>${safeText(player.sixes, "-")}</td>
          <td>${safeText(player.strikeRate, "-")}</td>
        </tr>
      `).join("")
    : teamInfo.length
      ? teamInfo.map((team) => `
          <tr>
            <td>${safeText(team.name)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
        `).join("")
      : `
        <tr>
          <td>No batter data available</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;

  const bowlingRows = bowling.length
    ? bowling.map((player) => `
        <tr>
          <td>${safeText(player.name)}</td>
          <td>${safeText(player.overs, "-")}</td>
          <td>${safeText(player.maidens, "-")}</td>
          <td>${safeText(player.runs, "-")}</td>
          <td>${safeText(player.wickets, "-")}</td>
          <td>${safeText(player.economy, "-")}</td>
        </tr>
      `).join("")
    : score.length
      ? score.map((inning) => `
          <tr>
            <td>${safeText(inning.inning, "Innings")}</td>
            <td>${safeText(inning.o, "-")}</td>
            <td>-</td>
            <td>${safeText(inning.r, "-")}</td>
            <td>${safeText(inning.w, "-")}</td>
            <td>-</td>
          </tr>
        `).join("")
      : `
        <tr>
          <td>No bowling data available</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;

  const inningsCards = score.length
    ? `
      <div class="summary-grid" style="margin-bottom:18px;">
        ${score.map((inning) => `
          <div class="info-box innings-box">
            <h4>${safeText(inning.inning, "Innings")}</h4>
            <div class="innings-big-score">${safeText(inning.r, "-")}/${safeText(inning.w, "-")}</div>
            <div class="innings-subline">${safeText(inning.o, "-")} overs</div>
          </div>
        `).join("")}
      </div>
    `
    : "";

  return `
    <div class="score-section">
      <h3>Scorecard</h3>
      ${inningsCards}

      <div class="table-wrap">
        <table class="score-table">
          <thead>
            <tr>
              <th>Batter</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>${battingRows}</tbody>
        </table>
      </div>

      <div class="table-wrap">
        <table class="score-table">
          <thead>
            <tr>
              <th>Bowler / Innings</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>${bowlingRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCommentaryTab(match) {
  return `
    <div class="score-section">
      <h3>Ball by Ball</h3>
      <div id="commentaryList" class="commentary-list">
        <p class="empty-message">Live commentary is not available for this match right now.</p>
      </div>
    </div>
  `;
}

async function fetchJson(url) {
  const response = await fetch(url);

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Response is not valid JSON");
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!data) {
    throw new Error("Empty response from API");
  }

  if (String(data.status).toLowerCase() === "failure") {
    throw new Error(data.reason || data.message || "API returned failure status");
  }

  return data;
}

async function fetchMatchDetails(matchId) {
  const url = `${MATCH_INFO_API_URL}${matchId}`;
  return await fetchJson(url);
}

async function fetchMatchCommentary(matchId) {
  try {
    const data = await fetchJson(`${COMMENTARY_API_URL}${matchId}`);
    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    console.error("Commentary error:", error);
    return [];
  }
}

async function openMatchModal(match) {
  const summaryTab = document.getElementById("summaryTab");
  const scorecardTab = document.getElementById("scorecardTab");
  const commentaryTab = document.getElementById("commentaryTab");

  if (!summaryTab || !scorecardTab || !commentaryTab) {
    modalBody.innerHTML = `
      <h2 class="modal-title">${safeText(match.teams)}</h2>
      <p class="empty-message">Modal tabs not found in HTML.</p>
    `;
    matchModal.classList.remove("hidden");
    return;
  }

  currentOpenMatch = match;

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.remove("active"));

  const summaryBtn = document.querySelector('.tab-btn[data-tab="summary"]');
  if (summaryBtn) summaryBtn.classList.add("active");

  summaryTab.classList.add("active");
  summaryTab.innerHTML = renderSummaryTab(match);
  scorecardTab.innerHTML = renderScorecardTab(match);
  commentaryTab.innerHTML = renderCommentaryTab(match);

  matchModal.classList.remove("hidden");

  if (String(match.id).startsWith("demo-")) {
    summaryTab.innerHTML = renderDetailedSummary(match, {
      score: [
        { inning: match.team1, r: 182, w: 5, o: 19.2 },
        { inning: match.team2, r: 170, w: 7, o: 20 }
      ],
      status: match.status,
      toss: `${match.team2} won the toss and chose to bowl`,
      matchWinner: "Result pending",
      batting: [
        { name: "R. Sharma", runs: 68, balls: 39, fours: 6, sixes: 3, strikeRate: 174.3 },
        { name: "V. Kohli", runs: 41, balls: 27, fours: 4, sixes: 1, strikeRate: 151.8 }
      ],
      bowling: [
        { name: "M. Starc", overs: 3.2, maidens: 0, runs: 31, wickets: 2, economy: 9.3 }
      ]
    }, [
      { over: "19.2", commentary: "Single to deep midwicket. Chase alive." },
      { over: "19.1", commentary: "FOUR! Full ball smashed through covers." },
      { over: "18.6", commentary: "WICKET! Top edge taken at short fine leg." }
    ]);

    scorecardTab.innerHTML = renderRealScorecard(match, {
      batting: [
        { name: "R. Sharma", runs: 68, balls: 39, fours: 6, sixes: 3, strikeRate: 174.3 },
        { name: "V. Kohli", runs: 41, balls: 27, fours: 4, sixes: 1, strikeRate: 151.8 }
      ],
      bowling: [
        { name: "M. Starc", overs: 3.2, maidens: 0, runs: 31, wickets: 2, economy: 9.3 }
      ],
      score: [
        { inning: match.team1, r: 182, w: 5, o: 19.2 }
      ]
    });

    const commentaryContainer = document.getElementById("commentaryList");
    if (commentaryContainer) {
      commentaryContainer.innerHTML = renderRealCommentary([
        { over: "19.2", commentary: "Single to deep midwicket. Chase alive." },
        { over: "19.1", commentary: "FOUR! Full ball smashed through covers." },
        { over: "18.6", commentary: "WICKET! Top edge taken at short fine leg." }
      ]);
    }
    return;
  }

  await loadOpenMatchData(match);
  startModalAutoRefresh();
}

function closeMatchModal() {
  matchModal.classList.add("hidden");
  stopModalAutoRefresh();
  currentOpenMatch = null;
}

async function loadOpenMatchData(match) {
  const summaryTab = document.getElementById("summaryTab");
  const scorecardTab = document.getElementById("scorecardTab");
  const commentaryContainer = document.getElementById("commentaryList");

  try {
    const [detailResponse, commentaryData] = await Promise.all([
      fetchMatchDetails(match.id),
      fetchMatchCommentary(match.id)
    ]);

    const details = detailResponse?.data || {};
    summaryTab.innerHTML = renderDetailedSummary(match, details, commentaryData);
    scorecardTab.innerHTML = renderRealScorecard(match, details);

    if (commentaryContainer) {
      commentaryContainer.innerHTML = renderRealCommentary(commentaryData);
    }
  } catch (error) {
    console.error("Open match data error:", error);

    if (summaryTab) {
      summaryTab.innerHTML = `
        ${renderSummaryTab(match)}
        <p class="empty-message" style="margin-top:18px;">Detailed match info is not available from API for this match.</p>
      `;
    }

    if (scorecardTab) {
      scorecardTab.innerHTML = `<p class="empty-message">Detailed scorecard not available from API.</p>`;
    }

    if (commentaryContainer) {
      commentaryContainer.innerHTML = `<p class="empty-message">Ball-by-ball commentary not available from API.</p>`;
    }
  }
}

function setButtonsDisabled(disabled) {
  button.disabled = disabled;
  upcomingButton.disabled = disabled;
  refreshLiveButton.disabled = disabled;
}

function startLiveAutoRefresh() {
  stopLiveAutoRefresh();
  liveRefreshInterval = setInterval(() => {
    loadLiveMatches(true);
  }, 60000);
}

function stopLiveAutoRefresh() {
  if (liveRefreshInterval) {
    clearInterval(liveRefreshInterval);
    liveRefreshInterval = null;
  }
}

function startModalAutoRefresh() {
  stopModalAutoRefresh();

  if (!currentOpenMatch) return;

  const state = getMatchStateFromStatus(currentOpenMatch.status, currentOpenMatch.isLive);
  if (state !== "live") return;

  modalRefreshInterval = setInterval(() => {
    if (!currentOpenMatch || matchModal.classList.contains("hidden")) return;
    loadOpenMatchData(currentOpenMatch);
  }, 30000);
}

function stopModalAutoRefresh() {
  if (modalRefreshInterval) {
    clearInterval(modalRefreshInterval);
    modalRefreshInterval = null;
  }
}

async function loadLiveMatches(isAutoRefresh = false) {
  if (isLoadingLive) return;

  isLoadingLive = true;
  setButtonsDisabled(true);

  if (!isAutoRefresh) {
    setMessage("Loading live matches...");
    showLoading(matchesDiv, "Loading live matches...");
  } else {
    setMessage("Refreshing live matches...");
  }

  try {
    const data = await fetchJson(LIVE_API_URL);
    const apiMatches = Array.isArray(data.data) ? data.data : [];
    liveMatchesCache = apiMatches.map((match) => normalizeMatch(match, "live"));

    if (!liveMatchesCache.length) {
      if (!useSavedLiveData("No fresh live data. Showing saved live matches.")) {
        useDemoLiveData("No live matches from API. Showing demo live matches.");
      }
      return;
    }

    populateSeriesFilter();
    filterAndDisplayLiveMatches();
    updateCounters();
    updateTimestamp();

    setMessage(`Loaded ${liveMatchesCache.length} live matches.`);
    saveMatchesToStorage();
    startLiveAutoRefresh();
  } catch (error) {
    console.error("Live matches error:", error);

    const errorText = String(error.message || "").toLowerCase();

    if (errorText.includes("limit") || errorText.includes("blocked")) {
      if (!useSavedLiveData("API limit reached. Showing saved live matches.")) {
        useDemoLiveData("API limit reached. Showing demo live matches.");
      }
    } else if (!navigator.onLine) {
      if (!useSavedLiveData("You are offline. Showing saved live matches.")) {
        useDemoLiveData("You are offline. Showing demo live matches.");
      }
    } else {
      if (!useSavedLiveData("Failed to load live matches. Showing saved data.")) {
        showEmpty(matchesDiv, "Could not fetch live scores.");
        setMessage(`Failed to load live matches: ${error.message}`);
      }
    }
  } finally {
    isLoadingLive = false;
    setButtonsDisabled(false);
  }
}

function isUpcomingMatch(match) {
  const status = String(match.status || "").toLowerCase();
  const dateValue = match.dateTimeGMT || match.date;
  const now = new Date();

  let matchDate = null;
  if (dateValue) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) matchDate = parsed;
  }

  const looksUpcomingByDate = matchDate && matchDate > now;
  const looksUpcomingByStatus =
    status.includes("upcoming") ||
    status.includes("not started") ||
    status.includes("starts at") ||
    status.includes("scheduled") ||
    status.includes("fixture") ||
    status.includes("yet to begin");

  const looksFinished =
    status.includes("won") ||
    status.includes("result") ||
    status.includes("completed") ||
    status.includes("match over") ||
    status.includes("stumps");

  return (looksUpcomingByDate || looksUpcomingByStatus) && !looksFinished;
}

async function loadUpcomingMatches() {
  if (isLoadingUpcoming) return;

  isLoadingUpcoming = true;
  setButtonsDisabled(true);
  setMessage("Loading upcoming matches...");
  showLoading(upcomingDiv, "Loading upcoming matches...");

  try {
    const data = await fetchJson(UPCOMING_API_URL);
    const apiMatches = Array.isArray(data.data) ? data.data : [];

    upcomingMatchesCache = apiMatches
      .filter((match) => isUpcomingMatch(match))
      .map((match) => normalizeMatch(match, "upcoming"));

    if (!upcomingMatchesCache.length) {
      if (!useSavedUpcomingData("No fresh upcoming data. Showing saved upcoming matches.")) {
        useDemoUpcomingData("No upcoming matches from API. Showing demo upcoming matches.");
      }
      return;
    }

    populateSeriesFilter();
    filterAndDisplayUpcomingMatches();
    updateCounters();
    updateTimestamp();

    setMessage(`Loaded ${upcomingMatchesCache.length} upcoming matches.`);
    saveMatchesToStorage();
  } catch (error) {
    console.error("Upcoming matches error:", error);

    const errorText = String(error.message || "").toLowerCase();

    if (errorText.includes("limit") || errorText.includes("blocked")) {
      if (!useSavedUpcomingData("API limit reached. Showing saved upcoming matches.")) {
        useDemoUpcomingData("API limit reached. Showing demo upcoming matches.");
      }
    } else if (!navigator.onLine) {
      if (!useSavedUpcomingData("You are offline. Showing saved upcoming matches.")) {
        useDemoUpcomingData("You are offline. Showing demo upcoming matches.");
      }
    } else {
      if (!useSavedUpcomingData("Failed to load upcoming matches. Showing saved data.")) {
        showEmpty(upcomingDiv, "Could not fetch upcoming matches.");
        setMessage(`Failed to load upcoming matches: ${error.message}`);
      }
    }
  } finally {
    isLoadingUpcoming = false;
    setButtonsDisabled(false);
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-content").forEach((tab) => {
    const isActive = tab.id === `${tabName}Tab`;
    tab.classList.toggle("active", isActive);
  });
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  themeToggle.textContent = theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  applyTheme(savedTheme);
}

function setupInstallPrompt() {
  if (!installBtn) return;

  installBtn.textContent = "⬇ Install App";

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      alert("Install not ready yet. Try opening in Chrome or deploy online.");
      return;
    }

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "inline-block";
  });
}

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installBtn) {
      installBtn.disabled = true;
      installBtn.textContent = "✅ Installed";
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(() => console.log("Service Worker Registered"))
        .catch((err) => console.log("SW Error:", err));
    });
  }
}

button.addEventListener("click", () => loadLiveMatches(false));
upcomingButton.addEventListener("click", loadUpcomingMatches);
refreshLiveButton.addEventListener("click", () => loadLiveMatches(false));

clearSearchButton.addEventListener("click", () => {
  searchInput.value = "";
  matchTypeFilter.value = "";
  seriesFilter.value = "";
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
  setMessage("Filters cleared.");
});

searchInput.addEventListener("input", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

matchTypeFilter.addEventListener("change", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

seriesFilter.addEventListener("change", () => {
  filterAndDisplayLiveMatches();
  filterAndDisplayUpcomingMatches();
  updateCounters();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(nextTheme);
});

closeModal.addEventListener("click", closeMatchModal);

matchModal.addEventListener("click", (event) => {
  if (event.target === matchModal) closeMatchModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !matchModal.classList.contains("hidden")) {
    closeMatchModal();
  }
});

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

window.addEventListener("online", () => {
  setMessage("Back online. You can refresh live data now.");
});

window.addEventListener("offline", () => {
  setMessage("You are offline. Showing saved or demo data.");
});

initTheme();
loadMatchesFromStorage();
populateSeriesFilter();

if (liveMatchesCache.length) {
  filterAndDisplayLiveMatches();
}
if (upcomingMatchesCache.length) {
  filterAndDisplayUpcomingMatches();
}
updateCounters();

setupInstallPrompt();
registerServiceWorker();

if (!liveMatchesCache.length) {
  useDemoLiveData("Ready to load matches. Demo live cards shown until API loads.");
}
if (!upcomingMatchesCache.length) {
  useDemoUpcomingData("Ready to load matches. Demo upcoming cards shown until API loads.");
}