/**
 * Music and sound effects.
 *
 * ── Missing assets ───────────────────────────────────────────────────────────
 * No audio files were supplied with the brief, so every entry in SOURCES is null
 * and playback is a no-op. Drop the files into `assets/audio/` and swap the nulls
 * for `require(...)` calls — nothing else needs to change.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type MusicTrack = 'menu' | 'game';
export type SfxName = 'win' | 'crash' | 'tap' | 'reward';

/** Replace the nulls with `require('@/assets/audio/<file>')` once assets land. */
const SOURCES: Record<MusicTrack | SfxName, AudioSource | null> = {
  menu: null,
  game: null,
  win: null,
  crash: null,
  tap: null,
  reward: null,
};

const MUSIC_VOLUME = 0.4;
const SFX_VOLUME = 0.8;

let musicPlayer: AudioPlayer | null = null;
let currentTrack: MusicTrack | null = null;
let musicEnabled = true;
let soundEnabled = true;
let vibrationEnabled = true;

/** Effect players are cached so repeated hits do not reallocate natively. */
const sfxPlayers = new Map<SfxName, AudioPlayer>();

export async function initAudio() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      // Duck rather than stop whatever the player already had going.
      interruptionModeAndroid: 'duckOthers',
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    // Audio session setup is best effort; play should continue regardless.
  }
}

/** Mirrors the settings toggles into the audio layer. */
export function applyAudioSettings(settings: {
  music: boolean;
  sound: boolean;
  vibration: boolean;
}) {
  musicEnabled = settings.music;
  soundEnabled = settings.sound;
  vibrationEnabled = settings.vibration;

  if (!musicEnabled) {
    musicPlayer?.pause();
  } else if (currentTrack && musicPlayer) {
    musicPlayer.play();
  }
}

export function playMusic(track: MusicTrack) {
  const source = SOURCES[track];
  if (!source) return;
  if (currentTrack === track && musicPlayer) {
    if (musicEnabled) musicPlayer.play();
    return;
  }

  musicPlayer?.remove();
  musicPlayer = createAudioPlayer(source);
  musicPlayer.loop = true;
  musicPlayer.volume = MUSIC_VOLUME;
  currentTrack = track;
  if (musicEnabled) musicPlayer.play();
}

export function stopMusic() {
  musicPlayer?.pause();
  currentTrack = null;
}

export function playSfx(name: SfxName) {
  if (!soundEnabled) return;
  const source = SOURCES[name];
  if (!source) return;

  let player = sfxPlayers.get(name);
  if (!player) {
    player = createAudioPlayer(source);
    player.volume = SFX_VOLUME;
    sfxPlayers.set(name, player);
  }
  player.seekTo(0);
  player.play();
}

/** Haptic feedback, gated on the vibration setting. */
export function vibrate(style: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') {
  if (!vibrationEnabled) return;
  try {
    switch (style) {
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      default:
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Unsupported on some devices and on web; ignore.
  }
}
