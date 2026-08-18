import Constants from 'expo-constants';

type LegalConfig = { termsUrl: string; privacyUrl: string };

/**
 * Legal document URLs.
 *
 * Configured in `expo.extra.legal` in app.json.
 */
export function getLegalUrls(): LegalConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as { legal?: Partial<LegalConfig> };
  return {
    termsUrl: extra.legal?.termsUrl ?? 'https://telegra.ph/TERMS-OF-USE-08-18-6',
    privacyUrl: extra.legal?.privacyUrl ?? 'https://telegra.ph/PRIVACY-POLICY-08-18-128',
  };
}
