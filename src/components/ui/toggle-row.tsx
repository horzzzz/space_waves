import { Switch, Text, View } from 'react-native';

import { Palette, Spacing, Type } from '@/constants/theme';

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

/** Label + switch row used throughout Settings. */
export function ToggleRow({ label, value, onValueChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.two }}>
      <Text style={[Type.body, { color: Palette.textPrimary }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.25)', true: Palette.lime }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
