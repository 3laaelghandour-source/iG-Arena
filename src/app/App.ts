import { Game } from "../game/Game";
import { GAME_MODES } from "../data/gameModes";
import { ARENA_MAPS } from "../game/core/maps";

type Screen = "home" | "play" | "armory" | "leaderboard" | "profile";

export class App {
  private screen: Screen = "home";
  private selectedMap = "foundry";
  private game: Game | null = null;

  constructor(private root: HTMLElement) {
    this.render();
    window.addEventListener("beforeunload", this.dispose);
  }

  private render(): void {
    if (this.game) return;

    this.root.innerHTML = [
      '<div class="app-shell">',
      this.renderHeader(),
      '<main class="page-content">',
      this.renderScreen(),
      '</main>',
      '<footer class="site-footer"><span>iG ARENA</span><span>INDEPENDENT BROWSER GAME</span><span class="footer-status"><i></i> LOCAL BUILD</span></footer>',
      '</div>'
    ].join("");

    this.bindNavigation();
  }

  private renderHeader(): string {
    const links: Array<{ id: Screen; label: string }> = [
      { id: "play", label: "PLAY" },
      { id: "armory", label: "LOADOUT" },
      { id: "leaderboard", label: "RANKINGS" },
      { id: "profile", label: "PROFILE" }
    ];

    return [
      '<header class="site-header">',
      '<button class="brand" data-screen="home" aria-label="iG Arena home"><span class="brand-mark">iG</span><span class="brand-name">ARENA</span></button>',
      '<nav class="main-nav" aria-label="Main navigation">',
      links.map((link) =>
        '<button class="nav-link ' + (this.screen === link.id ? "active" : "") + '" data-screen="' + link.id + '">' + link.label + '</button>'
      ).join(""),
      '</nav>',
      '<div class="header-status"><i></i><span>ALPHA BUILD</span></div>',
      '</header>'
    ].join("");
  }

  private renderScreen(): string {
    switch (this.screen) {
      case "play": return this.renderPlay();
      case "armory": return this.renderServicePage("armory");
      case "leaderboard": return this.renderServicePage("leaderboard");
      case "profile": return this.renderServicePage("profile");
      case "home":
      default: return this.renderHome();
    }
  }

  private renderHome(): string {
    return [
      '<section class="home-hero">',
      '<div class="hero-copy">',
      '<div class="eyebrow"><span></span> THE ARENA IS YOURS</div>',
      '<h1>STEP INTO<br><em>iG ARENA</em></h1>',
      '<p class="hero-description">A standalone browser-based arena game. Choose a mode, enter the facility and build your place in the arena.</p>',
      '<div class="hero-actions">',
      '<button class="button button-primary" data-screen="play">EXPLORE GAME MODES <span>↗</span></button>',
      '<button class="button button-secondary" data-action="start-training">QUICK TRAINING</button>',
      '</div>',
      '<div class="hero-meta"><span><b>01</b> PLAYABLE MODE</span><span><b>03</b> GAME MODES PLANNED</span><span><b>WEB</b> NO INSTALLATION</span></div>',
      '</div>',
      '<div class="hero-art" aria-hidden="true">',
      '<div class="art-grid"></div><div class="art-ring art-ring-one"></div><div class="art-ring art-ring-two"></div>',
      '<div class="art-cross"></div><div class="art-core"><span>iG</span><small>ARENA SYSTEM</small></div>',
      '<div class="art-coordinate coordinate-top">IG / 001</div><div class="art-coordinate coordinate-bottom">TRAIN. COMPETE. REPEAT.</div>',
      '</div>',
      '</section>',
      '<section class="home-lower">',
      '<div class="section-heading"><div><span class="eyebrow">CHOOSE YOUR EXPERIENCE</span><h2>GAME <em>MODES</em></h2></div><button class="text-link" data-screen="play">VIEW ALL MODES <span>→</span></button></div>',
      '<div class="mode-preview-grid">' + GAME_MODES.map((mode, index) => this.renderModeCard(mode, index)).join("") + '</div>',
      '</section>'
    ].join("");
  }

  private renderPlay(): string {
    return [
      '<section class="subpage-heading">',
      '<div class="eyebrow"><span></span> SELECT YOUR NEXT SESSION</div>',
      '<h1>CHOOSE A <em>MODE</em></h1>',
      '<p>Pick the experience you want to enter. Online playlists will unlock when the multiplayer service is connected.</p>',
      '</section>',
      '<section class="mode-grid">' + GAME_MODES.map((mode, index) => this.renderModeCard(mode, index, true)).join("") + '</section>',
      '<section class="map-catalog">',
      '<div class="section-heading"><div><span class="eyebrow">MAP ROTATION</span><h2>SELECT AN <em>ARENA</em></h2></div><span class="map-catalog-note">3 BLOCKOUT MAPS</span></div>',
      '<div class="map-card-grid">' + ARENA_MAPS.map((map) => this.renderMapCard(map)).join("") + '</div>',
      '<div class="map-selection-action"><span class="availability-pill"><i></i> LOCAL TRAINING AVAILABLE</span><button class="button button-primary" data-action="start-training">ENTER SELECTED MAP <span>→</span></button></div>',
      '</section>',
      '<p class="service-note"><span>i</span> Arena and Deathmatch are shown as planned modes. Matchmaking, player sessions and online scoring are not active yet.</p>'
    ].join("");
  }

  private renderModeCard(mode: typeof GAME_MODES[number], index: number, detailed = false): string {
    const available = mode.availability === "available";
    return [
      '<article class="mode-card ' + (available ? "mode-available" : "mode-planned") + '">',
      '<div class="mode-card-top"><span class="mode-index">0' + (index + 1) + '</span><span class="mode-status ' + (available ? "status-ready" : "status-planned") + '"><i></i>' + mode.status + '</span></div>',
      '<div class="mode-card-body"><span class="mode-category">' + mode.category + '</span><h3>' + mode.name + '</h3><p>' + mode.description + '</p></div>',
      '<div class="mode-card-bottom">',
      available
        ? '<button class="mode-action" data-action="start-training">ENTER MODE <span>↗</span></button>'
        : '<span class="mode-locked">IN DEVELOPMENT <span>⌁</span></span>',
      '</div>',
      detailed && !available ? '<p class="mode-detail">' + mode.detail + '</p>' : '',
      '</article>'
    ].join("");
  }

  private renderMapCard(map: typeof ARENA_MAPS[number]): string {
    const selected = this.selectedMap === map.id;
    return [
      '<button class="map-card ' + (selected ? "selected" : "") + '" data-map-choice="' + map.id + '" aria-pressed="' + selected + '">',
      '<span class="map-card-index">' + map.id.toUpperCase() + '</span>',
      '<strong>' + map.name + '</strong>',
      '<span class="map-card-environment">' + map.environment + '</span>',
      '<span class="map-card-description">' + map.description + '</span>',
      '<span class="map-card-select">' + (selected ? "SELECTED" : "SELECT MAP") + '</span>',
      '</button>'
    ].join("");
  }

  private renderServicePage(page: "armory" | "leaderboard" | "profile"): string {
    const content = {
      armory: {
        eyebrow: "PLAYER CUSTOMIZATION",
        title: 'YOUR <em>LOADOUT</em>',
        description: "The loadout system will let players manage their in-game equipment and saved presets.",
        status: "LOADOUT SERVICE NOT CONNECTED",
        detail: "No saved equipment or player inventory is being simulated in this build."
      },
      leaderboard: {
        eyebrow: "COMPETITIVE PROGRESSION",
        title: 'THE <em>RANKINGS</em>',
        description: "Leaderboards will track match results, placements and player progression.",
        status: "ONLINE MATCH DATA REQUIRED",
        detail: "Rankings will appear after player accounts and persistent match records are implemented."
      },
      profile: {
        eyebrow: "PLAYER IDENTITY",
        title: 'PLAYER <em>PROFILE</em>',
        description: "Your profile will collect your player identity, match history and long-term statistics.",
        status: "ACCOUNT SYSTEM NOT CONNECTED",
        detail: "This local build does not create accounts or store personal player profiles."
      }
    }[page];

    return [
      '<section class="service-page">',
      '<div class="service-page-mark">' + (page === "armory" ? "02" : page === "leaderboard" ? "03" : "04") + '</div>',
      '<div class="eyebrow"><span></span> ' + content.eyebrow + '</div>',
      '<h1>' + content.title + '</h1>',
      '<p class="service-description">' + content.description + '</p>',
      '<div class="service-state"><span class="state-line"></span><div><strong>' + content.status + '</strong><p>' + content.detail + '</p></div></div>',
      '<button class="button button-secondary" data-screen="play">BACK TO GAME MODES <span>→</span></button>',
      '</section>'
    ].join("");
  }

  private bindNavigation(): void {
    this.root.querySelectorAll<HTMLElement>("[data-screen]").forEach((element) => {
      element.addEventListener("click", () => {
        const screen = element.dataset.screen as Screen | undefined;
        if (!screen) return;
        this.screen = screen;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>("[data-map-choice]").forEach((element) => {
      element.addEventListener("click", () => {
        const mapId = element.dataset.mapChoice;
        if (!mapId || !ARENA_MAPS.some((map) => map.id === mapId)) return;
        this.selectedMap = mapId;
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-action="start-training"]').forEach((element) => {
      element.addEventListener("click", () => this.startTraining(this.selectedMap));
    });
  }

  private startTraining(mapId: string = this.selectedMap): void {
    if (this.game) return;

    this.root.innerHTML = [
      '<section class="game-view">',
      '<div id="game-root" class="game-canvas"></div>',
      '<header class="game-topbar"><div class="game-brand"><span class="brand-mark">iG</span><span>TRAINING · ' + mapId.toUpperCase() + '</span></div><button class="game-exit" id="exit-session">EXIT SESSION <span>×</span></button></header>',
      '<section class="hud" aria-live="polite">',
      '<div class="hud-card health-card"><span class="hud-label">HEALTH</span><strong id="health-value">100</strong><div class="meter"><i id="health-fill"></i></div></div>',
      '<div class="hud-card score-card"><span class="hud-label">SCORE</span><strong id="score-value">0000</strong><span class="hud-sub">TARGETS HIT</span></div>',
      '<div class="hud-card accuracy-card"><span class="hud-label">ACCURACY</span><strong id="accuracy-value">100%</strong><span class="hud-sub">HIT RATE</span></div>',
      '<div class="hud-card time-card"><span class="hud-label">SESSION</span><strong id="time-value">00:00</strong><span class="hud-sub">ELAPSED TIME</span></div>',
      '<div class="hud-card ammo-card"><span class="hud-label">PULSE</span><strong><span id="ammo-value">30</span><small> / 120</small></strong><span class="hud-sub" id="weapon-status">READY</span></div>',
      '</section>',
      '<div class="crosshair" aria-hidden="true"></div><div class="hit-marker" id="hit-marker" aria-hidden="true">+</div>',
      '<div class="center-message" id="center-message"><div class="eyebrow">LOCAL SOLO SESSION</div><h1 id="overlay-title">ENTER THE <em>RANGE</em></h1><p id="overlay-description">Practice in the iG training facility.</p><button id="start-button" class="button button-primary">START TRAINING <span>→</span></button><button id="leave-training" class="leave-training" hidden>LEAVE TRAINING</button><div class="controls-hint">W A S D <span>MOVE</span> · MOUSE <span>AIM</span> · CLICK <span>FIRE</span> · R <span>RELOAD</span> · SHIFT <span>SPRINT</span></div></div>',
      '<div class="bottom-hint">ESC TO PAUSE · R TO RELOAD</div><div class="toast" id="toast"></div>',
      '</section>'
    ].join("");

    this.game = new Game({
      mapId,
      mount: this.root.querySelector<HTMLElement>("#game-root")!,
      onHud: (state) => {
        this.setText("#health-value", String(state.health));
        this.setText("#score-value", String(state.score).padStart(4, "0"));
        this.setText("#ammo-value", String(state.ammo));
        this.setText(".ammo-card small", " / " + state.reserve);
        this.setText("#weapon-status", state.status);
        this.setText("#accuracy-value", state.accuracy + "%");
        this.setText("#time-value", state.elapsed);
        const fill = this.root.querySelector<HTMLElement>("#health-fill");
        if (fill) fill.style.width = state.health + "%";
      },
      onHit: () => {
        const marker = this.root.querySelector<HTMLElement>("#hit-marker");
        if (!marker) return;
        marker.classList.remove("show");
        void marker.offsetWidth;
        marker.classList.add("show");
        window.setTimeout(() => marker.classList.remove("show"), 150);
      },
      onMessage: (message) => {
        const toast = this.root.querySelector<HTMLElement>("#toast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("visible");
        window.setTimeout(() => toast.classList.remove("visible"), 1400);
      }
    });

    const overlay = this.root.querySelector<HTMLElement>("#center-message")!;
    const title = this.root.querySelector<HTMLElement>("#overlay-title")!;
    const description = this.root.querySelector<HTMLElement>("#overlay-description")!;
    const startButton = this.root.querySelector<HTMLButtonElement>("#start-button")!;
    const leaveButton = this.root.querySelector<HTMLButtonElement>("#leave-training")!;

    startButton.addEventListener("click", () => this.game?.start());
    leaveButton.addEventListener("click", () => this.exitTraining());
    this.root.querySelector("#exit-session")?.addEventListener("click", () => {
      if (document.pointerLockElement) document.exitPointerLock();
      else this.exitTraining();
    });

    this.game.onPause = () => {
      title.innerHTML = 'SESSION <em>PAUSED</em>';
      description.textContent = "Your local training session is paused.";
      startButton.innerHTML = 'RESUME TRAINING <span>→</span>';
      leaveButton.hidden = false;
      overlay.classList.remove("hidden");
    };

    this.game.onResume = () => {
      overlay.classList.add("hidden");
    };
  }

  private setText(selector: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  private exitTraining(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.game?.dispose();
    this.game = null;
    this.screen = "play";
    this.render();
  }

  private dispose = (): void => {
    this.game?.dispose();
    this.game = null;
  };
}
