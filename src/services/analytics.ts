/**
 * AppMetrica reporting.
 *
 * The event names and parameter vocabulary are fixed by the client's spec
 * ("СТРОГО СОБЛЮДАТЬ") and must not be renamed or extended casually.
 *
 * Note on omissions:
 *  - `game` carries no `game` parameter because the spec only requires it when an
 *    app ships several games, and this one ships a single game.
 *  - `paywall` is not reported: the spec scopes it to apps with a subscription
 *    screen, and this build has none.
 */

import AppMetrica from '@appmetrica/react-native-analytics';

const API_KEY = '2c5dceaf-5f2d-4f93-97d9-54bc9fec7d88';

let activated = false;

/** Calls into the native reporter, swallowing failures so analytics never breaks play. */
function report(event: string, attributes: Record<string, unknown>) {
  if (!activated) return;
  try {
    AppMetrica.reportEvent(event, attributes);
  } catch (error) {
    if (__DEV__) console.warn(`[analytics] failed to report "${event}"`, error);
  }
}

export function initAnalytics() {
  if (activated) return;
  try {
    AppMetrica.activate({
      apiKey: API_KEY,
      sessionTimeout: 60,
      crashReporting: true,
      logs: __DEV__,
      sessionsAutoTracking: true,
      appOpenTrackingEnabled: true,
    });
    activated = true;
  } catch (error) {
    // The native module is missing in Expo Go; the app still has to run.
    if (__DEV__) console.warn('[analytics] AppMetrica unavailable', error);
  }
}

/** Игровой цикл: entering a level, clearing it, or dying. */
export function reportGame(action: 'start' | 'win' | 'loss') {
  report('game', { action });
}

/**
 * Покупка монет. Reserved for real-money coin purchases; spending soft currency in
 * the customization shop is deliberately not reported here.
 */
export function reportPurchase(
  action: 'click' | 'success' | 'error',
  itemId: string,
  price: number
) {
  report('purchase', { action, item_id: itemId, price });
}

/** Where a rewarded video was triggered from. */
export type RewardedSource = 'shop_free_coins' | 'wheel_claim' | 'boost_reward';

/**
 * Все Rewarded Video.
 *
 * The spec's summary table requires this event but its parameter list was missing
 * from the supplied document, so it follows the same `action` + source shape as the
 * other events. Confirm the exact contract with the client before release.
 */
export function reportRewardedAd(
  action: 'view' | 'reward' | 'error',
  source: RewardedSource
) {
  report('rewarded_ad', { action, source });
}

/** Открытие настроек. */
export function reportSettingsOpen() {
  report('settings', { action: 'open' });
}
