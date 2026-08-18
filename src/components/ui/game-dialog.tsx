import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { MetalPanel } from '@/components/ui/metal-panel';
import { Palette, Spacing, Type } from '@/constants/theme';

type Props = {
  visible: boolean;
  title?: string;
  children: React.ReactNode;
  /** When provided, renders the corner close button seen on the overlay dialogs. */
  onClose?: () => void;
  /** Blocks dismissing by tapping the backdrop, used for blocking states. */
  dismissable?: boolean;
};

/**
 * Centered overlay dialog. Rendered inline rather than through RN Modal so it can
 * sit above the Skia game canvas without a separate native window.
 */
export function GameDialog({ visible, title, children, onClose, dismissable = true }: Props) {
  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={dismissable ? onClose : undefined}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Animated.View
        entering={ZoomIn.springify().damping(20).stiffness(180).overshootClamping(1)}
        style={styles.panelWrapper}>
        <MetalPanel contentStyle={styles.panelContent}>
          {title && (
            <Text style={[Type.title, styles.title]} numberOfLines={2}>
              {title.toUpperCase()}
            </Text>
          )}
          {children}
        </MetalPanel>

        {onClose && (
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeButton}>
            <Image source={require('@/assets/game/icons/close.png')} style={styles.closeIcon} contentFit="contain" />
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    zIndex: 10,
  },
  panelWrapper: {
    width: '100%',
    maxWidth: 340,
  },
  panelContent: {
    gap: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  title: {
    textAlign: 'center',
    color: Palette.textOnMetal,
    textShadowColor: 'rgba(255,255,255,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  closeButton: {
    position: 'absolute',
    top: -14,
    right: -14,
    width: 34,
    height: 34,
  },
  closeIcon: {
    width: '100%',
    height: '100%',
  },
});
