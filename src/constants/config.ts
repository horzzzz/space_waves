import Constants from 'expo-constants';

type LegalConfig = { termsUrl: string; privacyUrl: string };

/**
 * Legal document URLs.
 *
 * The brief requires working Terms of Use / Privacy Policy links but did not supply
 * the addresses. They are configured in `expo.extra.legal` in app.json and must be
 * replaced with the client's real URLs before release.
 */
export function getLegalUrls(): LegalConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as { legal?: Partial<LegalConfig> };
  return {
    termsUrl: extra.legal?.termsUrl ?? 'https://spacewaves.example.com/terms',
    privacyUrl: extra.legal?.privacyUrl ?? 'https://spacewaves.example.com/privacy',
  };
}
