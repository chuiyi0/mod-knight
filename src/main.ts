import './styles.css';
import { RetroAudioEngine } from './audio/sfx';
import { getDailyChallengeFactors } from './content/biomes';
import {
  loadMetaSave,
  loadRunCheckpoint,
  recordStickerSeen,
  recordWeaponSeen,
  saveMetaSave,
  saveRunCheckpoint,
  settleRunIntoMeta,
  todayDateString,
  unlockAchievementInMeta
} from './platform/storage';
import { PixelCanvasRenderer } from './render/canvasRenderer';
import { LobbyStation, LobbyStationKind, WalkableLobby } from './sim/lobby';
import { DailyFactorId, MetaSave, SIM_DT } from './sim/types';
import { GameWorld } from './sim/world';
import { HudOverlay } from './ui/HudOverlay';
import { ModalManager } from './ui/Modals';
import { TouchAndKeyboardInput } from './ui/TouchControls';

let meta: MetaSave = loadMetaSave();
let scene: 'lobby' | 'dungeon' = 'lobby';
let lobby = new WalkableLobby();
let world: GameWorld | null = null;
let isDailyRun = false;
let hitstopTimer = 0;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud-root') as HTMLElement;
const touchRoot = document.getElementById('touch-root') as HTMLElement;
const modalRoot = document.getElementById('modal-root') as HTMLElement;
const rotateHint = document.getElementById('rotate-hint') as HTMLElement;

const renderer = new PixelCanvasRenderer(canvas);
const audio = new RetroAudioEngine();
const modals = new ModalManager(modalRoot);

function syncSettings() {
  audio.sfxEnabled = meta.settings.sfxEnabled;
  audio.bgmEnabled = meta.settings.bgmEnabled;
  renderer.shakeEnabled = meta.settings.shakeEnabled;
  if (!meta.settings.bgmEnabled) audio.stopBgm();
}
syncSettings();

const hud = new HudOverlay(hudRoot, {
  onPause: () => openPauseModal(),
  onSelectWeapon: (idx) => {
    if (world) {
      const p = world.getMainPlayer();
      if (idx >= 0 && idx < p.weapons.length) {
        p.activeWeaponIndex = idx;
        audio.play('switch');
      }
    }
  },
  onOpenBag: () => openPauseModal(),
  onLobbyQuickAction: (kind) => handleLobbyQuickWarp(kind),
  onResumeCheckpoint: () => resumeFromCheckpoint()
});

const input = new TouchAndKeyboardInput(touchRoot, {
  onUnlockAudio: () => {
    audio.unlock();
  },
  onOpenBag: () => {
    if (scene === 'dungeon' && !modals.isOpen) openPauseModal();
  },
  onTogglePause: () => {
    if (modals.isOpen && scene === 'lobby') {
      modals.close();
      return;
    }
    if (scene === 'dungeon') {
      if (modals.isOpen && world && world.state.status === 'paused_modal' && !world.state.pendingStickerOffer && !world.state.pendingTalentOptions) {
        modals.close();
        world.closeWorkshopModal();
      } else if (!modals.isOpen) {
        openPauseModal();
      }
    }
  }
});

// Portrait rotation suggestion (dismissible)
let rotateDismissed = false;
function checkOrientation() {
  const isMobilePortrait = window.innerHeight > window.innerWidth && window.innerWidth < 760;
  rotateHint.classList.toggle('hidden', rotateDismissed || !isMobilePortrait);
}
document.getElementById('btn-dismiss-rotate')?.addEventListener('click', () => {
  rotateDismissed = true;
  checkOrientation();
});
window.addEventListener('resize', () => {
  renderer.resize();
  checkOrientation();
});
checkOrientation();

function openPauseModal() {
  if (!world) return;
  world.state.status = 'paused_modal';
  modals.openDungeonBagAndPause(world, meta, {
    onResume: () => {
      if (world && !world.state.pendingStickerOffer && !world.state.pendingTalentOptions) {
        world.state.status = 'playing';
      }
    },
    onReturnLobby: () => finishRunAndReturnLobby(false),
    onToggleSettings: () => syncSettings()
  });
}

function makeWorldHooks() {
  return {
    onUnlockAchievement: (id: string) => {
      const res = unlockAchievementInMeta(meta, id);
      if (res.unlockedNow) {
        hud.pushToast(`🏅 解锁成就【${res.title}】+${res.reward}💎！`, '#ffd54f');
      }
    },
    onRecordWeapon: (wid: Parameters<typeof recordWeaponSeen>[1]) => {
      recordWeaponSeen(meta, wid);
      saveMetaSave(meta);
    },
    onRecordSticker: (sid: Parameters<typeof recordStickerSeen>[1]) => {
      const newlyUnlocked = recordStickerSeen(meta, sid);
      saveMetaSave(meta);
      if (newlyUnlocked) hud.pushToast('🧚 收集满10种贴纸！解锁宠物【贴纸小精灵】！', '#ff80ab');
    },
    onRecordBossKill: (kind: string) => {
      meta.bossKills[kind] = (meta.bossKills[kind] ?? 0) + 1;
      saveMetaSave(meta);
    }
  };
}

function startNewRun(dailyFactors: DailyFactorId[] = []) {
  isDailyRun = dailyFactors.length > 0;
  world = new GameWorld({
    heroId: meta.selectedHero,
    heroLevel: meta.heroLevels[meta.selectedHero] ?? 1,
    petId: meta.selectedPet,
    dailyFactors,
    preparedWeapon: meta.preparedWeapon,
    preparedStickers: meta.preparedStickers,
    preparedTalents: meta.preparedTalents,
    preparedLucky: meta.preparedLucky,
    ...makeWorldHooks()
  });
  saveRunCheckpoint(world.exportCheckpoint(0));
  scene = 'dungeon';
  audio.play('portal');
  audio.startBgm('dungeon');
  hud.pushToast('⚔️ 进入 1-1 地牢！左摇杆走位，右手攻击/技能/切枪！', '#80d8ff');
}

function resumeFromCheckpoint() {
  const cp = loadRunCheckpoint();
  if (!cp) {
    startNewRun();
    return;
  }
  isDailyRun = cp.dailyFactors.length > 0;
  world = GameWorld.fromCheckpoint(cp, makeWorldHooks());
  scene = 'dungeon';
  audio.play('portal');
  audio.startBgm('dungeon');
  hud.pushToast(`💾 已从第 ${cp.floor} 层断点继续冒险！`, '#69f0ae');
}

function finishRunAndReturnLobby(won: boolean) {
  if (world) {
    const p = world.getMainPlayer();
    const res = settleRunIntoMeta(meta, {
      won,
      floor: world.state.floor,
      gemsEarned: p.gemsEarned,
      coinsRemaining: p.coins,
      materials: p.materialsEarned,
      seeds: p.seedsEarned,
      weaponsHeld: p.weapons.map((w) => w.defId),
      isDailyChallenge: isDailyRun
    });
    hud.pushToast(`🏠 回到客厅！带回 +${res.totalGems} 蓝币与材料！`, '#ffd54f');
  }
  world = null;
  scene = 'lobby';
  lobby = new WalkableLobby();
  audio.startBgm('lobby');
}

function openLobbyStationModal(station: LobbyStation) {
  const onClose = () => {};
  const toast = (m: string) => hud.pushToast(m, '#ffd54f');

  switch (station.kind) {
    case 'portal':
      modals.openPortalModal(meta, loadRunCheckpoint(), {
        onStartNormal: () => startNewRun([]),
        onStartDaily: () => startNewRun(getDailyChallengeFactors(todayDateString(), meta.dailySeedOffset)),
        onResume: () => resumeFromCheckpoint(),
        onClose
      });
      break;
    case 'hero_npc':
      modals.openHeroesModal(meta, station.heroId, toast, onClose);
      break;
    case 'pet_bed':
      modals.openPetsModal(meta, toast, onClose);
      break;
    case 'garden':
      modals.openGardenModal(meta, toast, onClose);
      break;
    case 'forge':
      modals.openForgeModal(meta, toast, onClose);
      break;
    case 'sticker_bench':
      modals.openStickerBenchModal(meta, toast, onClose);
      break;
    case 'gacha':
      modals.openGachaModal(meta, toast, onClose);
      break;
    case 'daily_board':
      modals.openDailyBoardModal(meta, (factors) => startNewRun(factors), toast, onClose);
      break;
    case 'cellar':
      modals.openCellarModal(meta, onClose);
      break;
    case 'tv_stats':
      modals.openStatsAndSaveModal(
        meta,
        (imported) => {
          meta = imported;
          syncSettings();
        },
        toast,
        onClose
      );
      break;
    case 'lan_terminal':
      modals.openLanTerminalModal(onClose);
      break;
  }
}

function handleLobbyQuickWarp(kind: LobbyStationKind) {
  const st = lobby.warpToStation(kind);
  if (st) {
    audio.play('switch');
    openLobbyStationModal(st);
  }
}

function processWorldEvents() {
  if (!world) return;
  const evs = world.consumeEvents();
  for (const ev of evs) {
    switch (ev.type) {
      case 'sfx':
        audio.play(ev.sound, ev.pitch);
        if (ev.sound === 'boss_intro') audio.startBgm('boss');
        break;
      case 'shake':
        renderer.triggerShake(ev.intensity, ev.duration);
        break;
      case 'hitstop':
        hitstopTimer = Math.max(hitstopTimer, ev.duration);
        break;
      case 'toast':
        hud.pushToast(ev.text, ev.color);
        break;
      case 'sticker_pickup':
        modals.openStickerOffer(world, () => {});
        break;
      case 'workshop_open':
        modals.openWorkshopShop(world, ev.interactableId, () => {});
        break;
      case 'talent_choice':
        modals.openTalentChoice(world, () => {});
        break;
      case 'floor_complete':
        saveRunCheckpoint(world.exportCheckpoint(0));
        audio.startBgm('dungeon');
        break;
      case 'run_victory': {
        const p = world.getMainPlayer();
        const estGems = p.gemsEarned + Math.floor(p.coins * 1.2) + world.state.floor * 45;
        modals.openRunResult(world, true, estGems, {
          onEndless: () => {
            world?.continueIntoEndless();
            if (world) saveRunCheckpoint(world.exportCheckpoint(0));
          },
          onLobby: () => finishRunAndReturnLobby(true)
        });
        break;
      }
      case 'run_gameover': {
        const p = world.getMainPlayer();
        const estGems = p.gemsEarned + Math.floor(p.coins * 1.2) + world.state.floor * 45;
        modals.openRunResult(world, false, estGems, {
          onRevive: () => {
            world?.triggerRevive();
          },
          onLobby: () => finishRunAndReturnLobby(false)
        });
        break;
      }
    }
  }
}

// === Main 60Hz Fixed-Timestep Loop ===
let lastTime = performance.now();
let accumulator = 0;

function frame(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    requestAnimationFrame(frame);
    return;
  }

  accumulator += dt;
  const cmd = input.pollCommand('p1');

  if (scene === 'lobby') {
    if (!modals.isOpen) {
      const triggered = lobby.step(cmd, dt);
      if (triggered) openLobbyStationModal(triggered);
    }
    const nearStation = lobby.state.stations.find((s) => s.id === lobby.state.nearestStationId);
    input.updateButtonVisuals({
      showInteract: Boolean(nearStation),
      interactLabel: nearStation ? '打开' : '互动',
      skillCooldown: 0,
      skillCharges: 1,
      isLobby: true
    });
    renderer.renderLobby(lobby.state, meta, dt);
    hud.renderLobbyHud(meta, Boolean(loadRunCheckpoint()));
    accumulator = 0;
  } else if (world) {
    while (accumulator >= SIM_DT) {
      if (!modals.isOpen && world.state.status === 'playing') {
        world.step([cmd], SIM_DT);
        processWorldEvents();
      }
      accumulator -= SIM_DT;
      // Clear single-frame edge presses after first substep
      cmd.firePressed = false;
      cmd.skillPressed = false;
      cmd.switchPressed = false;
      cmd.interactPressed = false;
    }

    const p1 = world.getMainPlayer();
    const near = world.findNearestInteractableOrPickup(p1);
    input.updateButtonVisuals({
      showInteract: Boolean(near),
      interactLabel: near?.type === 'pickup' ? '拾取' : '互动',
      skillCooldown: p1.skillCooldown,
      skillCharges: p1.skillCharges,
      isLobby: false
    });
    renderer.renderDungeon(world.state, dt);
    hud.renderDungeonHud(world.state);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
