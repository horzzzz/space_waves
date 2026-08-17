import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinBadge } from '@/components/ui/coin-badge';
import { IconButton } from '@/components/ui/icon-button';
import { SkyBackground } from '@/components/ui/sky-background';
import { MaxContentWidth, Spacing, Type } from '@/constants/theme';

type Props = {
  children: React.ReactNode;
  /** Uppercase label shown on the right of the top bar, matching the design. */
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  coins?: number;
  contentStyle?: React.ComponentProps<typeof View>['style'];
};

/** Standard screen shell: sky background, safe area, and the shared top bar. */
export function ScreenFrame({ children, title, onBack, showBack = true, coins, contentStyle }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/menu');
    }
  };

  return (
    <SkyBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.topBarSide}>
            {showBack && <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={handleBack} />}
          </View>
          {title ? (
            <Text style={[Type.heading, styles.title]} numberOfLines={1}>
              {title.toUpperCase()}
            </Text>
          ) : (
            <View style={styles.flex} />
          )}
          <View style={[styles.topBarSide, styles.alignEnd]}>
            {coins !== undefined && <CoinBadge amount={coins} />}
          </View>
        </View>

        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  topBarSide: {
    minWidth: 40,
    justifyContent: 'center',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'right',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
});
