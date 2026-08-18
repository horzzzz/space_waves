import { StyleSheet, Text, View } from 'react-native';

import { DisplayFont, Radius, Spacing } from '@/constants/theme';

type Props = {
  /** 0-based step index. */
  step: number;
  total: number;
  title?: string;
  body: string;
};

/**
 * The dark instructional card shown over the gameplay canvas between tutorial
 * steps — "N/total", an optional headline, and the step's body copy.
 */
export function TutorialCard({ step, total, title, body }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.counter}>{`${step + 1}/${total}`}</Text>
      {title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(16, 42, 72, 0.85)',
    borderRadius: Radius.large,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    gap: Spacing.one,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  counter: {
    textAlign: 'center',
    fontFamily: DisplayFont,
    fontSize: 14,
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  title: {
    textAlign: 'center',
    fontFamily: DisplayFont,
    fontSize: 18,
    letterSpacing: 0.6,
    color: '#FFFFFF',
    marginTop: Spacing.one,
  },
  body: {
    textAlign: 'center',
    fontFamily: DisplayFont,
    fontSize: 16,
    letterSpacing: 0.3,
    color: '#FFFFFF',
    marginTop: Spacing.half,
  },
});
