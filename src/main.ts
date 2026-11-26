import './styles.css';
import { RetroAudioEngine } from './audio/sfx';
import {
  loadMetaSave,
  loadRunCheckpoint,
  recordStickerSeen,
  recordWeaponSeen,
  saveMetaSave,
  saveRunCheckpoint,
  settleRunIntoMeta,
  unlockAchievementInMeta
} from './platform/storage';
import { PixelCanvasRenderer } from './render/canvasRenderer';
import { DailyFactorId, MetaSave, SIM_DT } from './sim/types';
import { GameWorld } from './sim/world';
import { HudOverlay } from './ui/HudOverlay';
import { ModalManager } from './ui/Modals';
import { TouchAndKeyboardInput } from './ui/TouchControls';

let meta: MetaSave = loadMetaSave();
let scene: 'lobby' | 'dungeon' = 'lobby';
let world: GameWorld | null = null;
let isDailyRun = false;
let hitstopTimer = 0;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const textCanvas = document.getElementById('text-canvas') as HTMLCanvasElement;
const hudRoot = document.getElementById('hud-root') as HTMLElement;
const touchRoot = document.getElementById('touch-root') as HTMLElement;
const modalRoot = document.getElementById('modal-root') as HTMLElement;
const rotateHint = document.getElementById('rotate-hint') as HTMLElement;

const renderer = new PixelCanvasRenderer(canvas, textCanvas);
const audio = new RetroAudioEngine();
const modals = new ModalManager(modalRoot);

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
  onOpenBag: () => openBagModal(),
  onOpenControls: () => openControlsFromPause(),
  onTeleportRoom: (roomId) => {
    world?.teleportToRoom(roomId);
  },
  onGroundEquip: (pid) => {
    world?.equipGroundWeaponById(pid);
  },
  onGroundStore: (pid) => {
    world?.storeGroundWeaponToVault(pid);
  },
  onGroundRecycle: (pid) => {
    world?.recycleGroundWeapon(pid);
  },
  onLobbyStart: () => {
    modals.openStartModal(meta, loadRunCheckpoint(), {
      onStartNormal: () => startNewRun([]),
      onStartDaily: (factors) => startNewRun(factors),
      onResume: () => resumeFromCheckpoint(),
      onClose: () => {}
    });
  },
  onLobbyResume: () => resumeFromCheckpoint(),
  onLobbyHeroes: () => {
    modals.openHeroesAndPetsHub(meta, (m) => hud.pushToast(m, '#ffd54f'), () => {});
  },
  onLobbyCamp: () => {
    modals.openCampHub(meta, (factors) => startNewRun(factors), (m) => hud.pushToast(m, '#ffd54f'), () => {});
  },
  onLobbyCellar: () => {
    modals.openCellarAndSettingsHub(meta, {
      onImported: (imported) => {
        meta = imported;
        syncSettings();
      },
      onApplyControls: () => input.applySettings(meta.settings),
      onToast: (m) => hud.pushToast(m, '#ffd54f'),
      onClose: () => {}
    });
  }
});

const input = new TouchAndKeyboardInput(touchRoot, meta.settings, {
  onUnlockAudio: () => audio.unlock(),
  onOpenBag: () => {
    if (scene === 'dungeon' && !modals.isOpen) openBagModal();
  },
  onTogglePause: () => {
    if (modals.isOpen) {
      if (scene === 'lobby') {
        modals.close();
      } else if (world && !world.state.pendingTalentOptions) {
        modals.close();
        world.closeWorkshopModal();
      }
    } else if (scene === 'dungeon') {
      openPauseModal();
    }
  }
});

function syncSettings() {
  audio.sfxEnabled = meta.settings.sfxEnabled;
  audio.bgmEnabled = meta.settings.bgmEnabled;
  renderer.shakeEnabled = meta.settings.shakeEnabled;
  input.applySettings(meta.settings);
  if (!meta.settings.bgmEnabled) audio.stopBgm();
}
syncSettings();

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

function openBagModal() {
  if (!world) return;
  world.state.status = 'paused_modal';
  modals.openVaultAndStickerBag(world, () => {
    if (world && !world.state.pendingTalentOptions) world.state.status = 'playing';
  });
}

function openControlsFromPause() {
  modals.openControlsEditor(
    meta,
    () => input.applySettings(meta.settings),
    (m) => hud.pushToast(m, '#ffd54f'),
    () => openPauseModal()
  );
}

function openPauseModal() {
  if (!world) return;
  world.state.status = 'paused_modal';
  modals.openPauseMenu(world, meta, {
    onResume: () => {
      if (world && !world.state.pendingTalentOptions) world.state.status = 'playing';
    },
    onReturnLobby: () => finishRunAndReturnLobby(false),
    onToggleSettings: () => syncSettings(),
    onOpenControls: () => openControlsFromPause()
  });
}

function makeWorldHooks() {
  return {
    onUnlockAchievement: (id: string) => {
      const res = unlockAchievementInMeta(meta, id);
      if (res.unlockedNow) hud.pushToast(`🏅 解锁成就【${res.title}】+${res.reward}💎！`, '#ffd54f');
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
  renderer.resetCamera();
  saveRunCheckpoint(world.exportCheckpoint(0));
  scene = 'dungeon';
  audio.play('portal');
  audio.startBgm('dungeon');
  hud.pushToast('🗺️ 出发探险！贴纸自动入背包，地上武器可一键装备/存仓库/回收！', '#80d8ff');
}

function resumeFromCheckpoint() {
  const cp = loadRunCheckpoint();
  if (!cp) {
    startNewRun();
    return;
  }
  isDailyRun = cp.dailyFactors.length > 0;
  world = GameWorld.fromCheckpoint(cp, makeWorldHooks());
  renderer.resetCamera();
  scene = 'dungeon';
  audio.play('portal');
  audio.startBgm('dungeon');
  hud.pushToast(`💾 已从第 ${cp.floor} 区继续探险！`, '#69f0ae');
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
    hud.pushToast(`🏠 返回首页！带回 +${res.totalGems} 蓝币与材料！`, '#ffd54f');
  }
  world = null;
  scene = 'lobby';
  audio.startBgm('lobby');
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
      case 'workshop_open':
        modals.openWorkshopShop(world, ev.interactableId, () => {});
        break;
      case 'talent_choice':
        modals.openTalentChoice(world, () => {});
        break;
      case 'floor_complete':
        renderer.resetCamera();
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
          onRevive: () => world?.triggerRevive(),
          onLobby: () => finishRunAndReturnLobby(false)
        });
        break;
      }
    }
  }
}

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
    input.setVisible(false);
    renderer.renderSimpleLobbyBackdrop(meta, dt);
    hud.renderSimpleLobbyHud(meta, Boolean(loadRunCheckpoint()));
    accumulator = 0;
  } else if (world) {
    input.setVisible(!modals.isOpen);
    while (accumulator >= SIM_DT) {
      if (!modals.isOpen && world.state.status === 'playing') {
        world.step([cmd], SIM_DT);
        processWorldEvents();
      }
      accumulator -= SIM_DT;
      cmd.firePressed = false;
      cmd.skillPressed = false;
      cmd.switchPressed = false;
      cmd.interactPressed = false;
    }

    const p1 = world.getMainPlayer();
    const nearInter = world.findNearestInteractable(p1);
    const nearGroundWpn = world.findNearestGroundWeapon(p1);
    input.updateButtonVisuals({
      showInteract: Boolean(nearInter),
      interactLabel: nearInter?.kind === 'portal' ? '传送' : '互动',
      skillCooldown: p1.skillCooldown,
      skillCharges: p1.skillCharges
    });
    renderer.renderDungeon(world.state, dt);
    hud.renderDungeonHud(world.state, nearGroundWpn, world.getExplorationProgress());
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
