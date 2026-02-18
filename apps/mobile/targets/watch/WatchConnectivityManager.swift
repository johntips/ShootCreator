import Foundation
import WatchConnectivity

class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    @Published var isReachable = false

    private override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    // MARK: - Send (Watch → iPhone)

    /// ショット送信 — transferUserInfo で確実にキュー転送
    func sendShot(zoneId: String, made: Bool) {
        let payload: [String: Any] = [
            "type": "shot",
            "zoneId": zoneId,
            "made": made,
            "timestamp": Date().timeIntervalSince1970 * 1000,
        ]
        WCSession.default.transferUserInfo(payload)

        // リアルタイム補助（接続中のみ）
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil) { _ in }
        }
    }

    /// ゾーン変更通知（最新状態のみ上書き）
    func sendSelectedZone(_ zoneId: String) {
        try? WCSession.default.updateApplicationContext(["selectedZone": zoneId])
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async {
            self.handleIncoming(message)
        }
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        DispatchQueue.main.async {
            self.handleIncoming(applicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        DispatchQueue.main.async {
            self.handleIncoming(userInfo)
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    // MARK: - Incoming (iPhone → Watch)

    private func handleIncoming(_ data: [String: Any]) {
        // iPhone からゾーン変更
        if let zoneId = data["selectedZone"] as? String {
            NotificationCenter.default.post(
                name: .zoneChangedFromiPhone,
                object: nil,
                userInfo: ["zoneId": zoneId]
            )
        }

        // iPhone からスタッツ同期
        if data["zoneStats"] != nil {
            NotificationCenter.default.post(
                name: .statsUpdatedFromiPhone,
                object: nil,
                userInfo: data
            )
        }
    }
}

extension Notification.Name {
    static let zoneChangedFromiPhone = Notification.Name("zoneChangedFromiPhone")
    static let statsUpdatedFromiPhone = Notification.Name("statsUpdatedFromiPhone")
}
