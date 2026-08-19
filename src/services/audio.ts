/**
 * Music and sound effects.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type MusicTrack = 'menu' | 'game';
export type SfxName = 'win' | 'crash' | 'tap' | 'reward';

const SOURCES: Record<MusicTrack | SfxName, AudioSource | null> = {
  menu: require('@/assets/audio/music-menu.m4a'),
  game: require('@/assets/audio/music-game.m4a'),
  win: require('@/assets/audio/sfx-win.m4a'),
  crash: require('@/assets/audio/sfx-crash.m4a'),
  tap: require('@/assets/audio/sfx-tap.m4a'),
  reward: require('@/assets/audio/sfx-reward.m4a'),
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

export async function playSfx(name: SfxName) {
  if (!soundEnabled) return;
  const source = SOURCES[name];
  if (!source) return;

  let player = sfxPlayers.get(name);
  if (!player) {
    player = createAudioPlayer(source);
    player.volume = SFX_VOLUME;
    sfxPlayers.set(name, player);
  }
  // Must resolve before play(): on a repeat play the player is sitting at the
  // end of the clip from last time, and starting playback before the seek
  // lands plays silence (or the last few ms) instead of the sound.
  await player.seekTo(0);
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
