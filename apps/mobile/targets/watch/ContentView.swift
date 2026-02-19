import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: SessionState
    @EnvironmentObject var connectivity: WatchConnectivityManager
    @State private var showZones = true

    var body: some View {
        NavigationStack {
            if !session.isSessionActive {
                // idle — iPhone でセッション開始を待つ
                IdleView()
                    .navigationTitle("ShootCreater")
            } else if showZones {
                ZoneMapView(onSelect: { zoneId in
                    session.selectedZoneId = zoneId
                    connectivity.sendSelectedZone(zoneId)
                    showZones = false
                })
                .navigationTitle("Zone")
            } else {
                CounterView(onBack: {
                    showZones = true
                })
                .navigationTitle(session.currentZoneLabel)
            }
        }
    }
}

/// セッション未開始時の待機画面（コネクション状態表示付き）
struct IdleView: View {
    @EnvironmentObject var connectivity: WatchConnectivityManager

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Image(systemName: "iphone")
                    .font(.system(size: 32))
                    .foregroundColor(.blue.opacity(0.7))

                Text("iPhoneでセッションを\n開始してください")
                    .font(.system(size: 13, weight: .medium))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.white.opacity(0.8))

                // コネクション状態
                VStack(spacing: 6) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(connectivity.isReachable ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(connectivity.isReachable ? "接続中" : "未接続")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(connectivity.isReachable ? .green : .red)
                    }

                    HStack(spacing: 4) {
                        Text("Activation:")
                            .font(.system(size: 10))
                            .foregroundColor(.gray)
                        Text(connectivity.activationState)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }

                    HStack(spacing: 4) {
                        Text("Handshake:")
                            .font(.system(size: 10))
                            .foregroundColor(.gray)
                        Text(connectivity.lastHandshakeResult)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }
                }

                // 再接続ボタン
                Button(action: {
                    connectivity.sendWatchReady()
                }) {
                    Text("再接続")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.blue)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.15))
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
            .padding()
        }
    }
}
