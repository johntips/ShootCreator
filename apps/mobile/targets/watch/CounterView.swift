import SwiftUI

struct CounterView: View {
    @EnvironmentObject var session: SessionState
    @EnvironmentObject var connectivity: WatchConnectivityManager
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            // グループバッジ
            if let group = session.currentGroup {
                Text(group.label)
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(group.color)
                    .cornerRadius(4)
            }

            // Zone stats
            Text("\(session.currentZone.made) / \(session.currentZone.attempted)")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(.white)

            if session.currentZone.attempted > 0 {
                Text("\(session.currentZone.percentage)%")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.gray)
            }

            // MADE / MISS ボタン
            HStack(spacing: 6) {
                Button(action: {
                    session.recordShot(made: false)
                    connectivity.sendShot(
                        zoneId: session.selectedZoneId,
                        made: false
                    )
                }) {
                    Text("MISS")
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.red.opacity(0.8))
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)

                Button(action: {
                    session.recordShot(made: true)
                    connectivity.sendShot(
                        zoneId: session.selectedZoneId,
                        made: true
                    )
                }) {
                    Text("MADE")
                        .font(.system(size: 13, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Color.green.opacity(0.8))
                        .cornerRadius(10)
                }
                .buttonStyle(.plain)
            }

            // Total
            Text("Total: \(session.totalMade)/\(session.totalAttempted)")
                .font(.system(size: 11))
                .foregroundColor(.gray)

            // ゾーン変更ボタン
            Button("Change Zone") { onBack() }
                .font(.system(size: 11))
        }
        .padding(.horizontal, 4)
    }
}
