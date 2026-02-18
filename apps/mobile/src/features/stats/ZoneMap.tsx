import { getZoneStats } from "@shoot-creater/core";
import type { Session, Zone } from "@shoot-creater/core";
import { StyleSheet, View } from "react-native";

interface ZoneMapProps {
  zones: Zone[];
  session: Session;
  selectedZoneId: string;
}

/**
 * ゾーンマップ表示（将来: SVG描画）
 * 初期実装ではZoneSelectorで代替。SVG pathが定義されたら描画を追加。
 */
export function ZoneMap({
  zones: _zones,
  session: _session,
  selectedZoneId: _selectedZoneId,
}: ZoneMapProps) {
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  placeholder: { height: 0 },
});
