import Foundation
import WatchConnectivity

#if DEBUG
private func syncLog(_ message: String) {
    NSLog("%@", message)
}
#else
private func syncLog(_ message: String) {}
#endif

class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()

    @Published var isReachable = false
    @Published var activationState: String = "unknown"
    @Published var lastHandshakeResult: String = "—"

    /// 重複排除用の shotId セット
    private var seenShotIds: Set<String> = []

    private override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
            syncLog("[WSync:Conn] WCSession activating...")
        } else {
            syncLog("[WSync:Conn] WCSession not supported")
        }
    }

    // MARK: - Send (Watch → iPhone)

    /// ショット送信 — transferUserInfo + sendMessage デュアル送信
    func sendShot(zoneId: String, made: Bool) {
        let shotId = "\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(6))"
        seenShotIds.insert(shotId)  // 自分発エコーを事前登録

        let payload: [String: Any] = [
            "type": "shot",
            "shotId": shotId,
            "zoneId": zoneId,
            "made": made,
            "timestamp": Date().timeIntervalSince1970 * 1000,
            "source": "watch",
        ]

        syncLog("[WSync:Send] reliable → shot \(shotId) zone=\(zoneId) made=\(made)")
        WCSession.default.transferUserInfo(payload)

        // リアルタイム補助（接続中のみ）
        if WCSession.default.isReachable {
            syncLog("[WSync:Send] realtime → shot \(shotId)")
            WCSession.default.sendMessage(payload, replyHandler: nil) { error in
                syncLog("[WSync:Send] realtime FAIL: \(error.localizedDescription)")
            }
        } else {
            syncLog("[WSync:Send] realtime SKIP (not reachable)")
        }
    }

    /// ゾーン変更通知（最新状態のみ上書き）
    func sendSelectedZone(_ zoneId: String) {
        syncLog("[WSync:Send] context → selectedZone=\(zoneId)")
        try? WCSession.default.updateApplicationContext(["selectedZone": zoneId])
    }

    /// watch-ready ハンドシェイク — iPhone に現在のセッション状態を問い合わせ
    func sendWatchReady() {
        guard WCSession.default.isReachable else {
            syncLog("[WSync:Hand] watch-ready SKIP (not reachable)")
            return
        }
        syncLog("[WSync:Hand] watch-ready → sending to iPhone...")
        let payload: [String: Any] = ["type": "watch-ready", "timestamp": Date().timeIntervalSince1970 * 1000]
        WCSession.default.sendMessage(payload, replyHandler: { [weak self] reply in
            syncLog("[WSync:Hand] watch-ready ← reply: \(reply)")
            guard let hasActive = reply["hasActiveSession"] as? Bool else { return }
            DispatchQueue.main.async {
                if hasActive {
                    syncLog("[WSync:Hand] → session ACTIVE, activating Watch")
                    self?.lastHandshakeResult = "active"
                    NotificationCenter.default.post(
                        name: .sessionStartedFromiPhone,
                        object: nil,
                        userInfo: reply
                    )
                } else {
                    syncLog("[WSync:Hand] → no active session")
                    self?.lastHandshakeResult = "idle"
                    self?.isReachable = true
                }
            }
        }, errorHandler: { [weak self] error in
            syncLog("[WSync:Hand] watch-ready FAIL: \(error.localizedDescription)")
            DispatchQueue.main.async {
                self?.lastHandshakeResult = "error"
            }
        })
    }

    // MARK: - WCSessionDelegate

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        let stateStr = switch activationState {
        case .activated: "activated"
        case .inactive: "inactive"
        case .notActivated: "notActivated"
        @unknown default: "unknown"
        }
        syncLog("[WSync:Conn] activation complete: \(stateStr), reachable=\(session.isReachable)")
        if let error = error {
            syncLog("[WSync:Conn] activation error: \(error.localizedDescription)")
        }
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            self.activationState = stateStr
            // activation 完了＆reachable → ハンドシェイク開始
            if activationState == .activated && session.isReachable {
                self.sendWatchReady()
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        syncLog("[WSync:Recv] message ← type=\(message["type"] as? String ?? "nil")")
        DispatchQueue.main.async {
            self.handleIncoming(message, channel: "message")
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        syncLog("[WSync:Recv] message(reply) ← type=\(message["type"] as? String ?? "nil")")
        DispatchQueue.main.async {
            self.handleIncoming(message, channel: "message")
        }
        // iPhone からの replyHandler 付きメッセージには空返信
        replyHandler([:])
    }

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        syncLog("[WSync:Recv] app-context ← keys=\(Array(applicationContext.keys))")
        DispatchQueue.main.async {
            self.handleIncoming(applicationContext, channel: "app-context")
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        syncLog("[WSync:Recv] user-info ← type=\(userInfo["type"] as? String ?? "nil")")
        DispatchQueue.main.async {
            self.handleIncoming(userInfo, channel: "user-info")
        }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        syncLog("[WSync:Conn] reachability changed → \(session.isReachable)")
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            // reachable になったらハンドシェイク再試行
            if session.isReachable {
                self.sendWatchReady()
            }
        }
    }

    // MARK: - Incoming (iPhone → Watch)

    private func handleIncoming(_ data: [String: Any], channel: String) {
        // ゾーン変更
        if let zoneId = data["selectedZone"] as? String {
            syncLog("[WSync:Recv] [\(channel)] zone-change → \(zoneId)")
            NotificationCenter.default.post(
                name: .zoneChangedFromiPhone,
                object: nil,
                userInfo: ["zoneId": zoneId]
            )
        }

        // iPhone からのショット受信
        if let type = data["type"] as? String, type == "shot",
           let source = data["source"] as? String, source == "iphone",
           let shotId = data["shotId"] as? String {
            // 重複排除
            guard !seenShotIds.contains(shotId) else {
                syncLog("[WSync:Recv] [\(channel)] shot \(shotId) → DUPLICATE (ignored)")
                return
            }
            seenShotIds.insert(shotId)

            if let zoneId = data["zoneId"] as? String,
               let made = data["made"] as? Bool {
                syncLog("[WSync:Recv] [\(channel)] shot \(shotId) → ACCEPTED zone=\(zoneId) made=\(made)")
                NotificationCenter.default.post(
                    name: .shotReceivedFromiPhone,
                    object: nil,
                    userInfo: ["zoneId": zoneId, "made": made]
                )
            }
        }

        // スタッツ同期（フルスナップショット）
        // applicationContext 経由 ({zoneStats: [...]}) と
        // sendMessage 経由 ({type: "stats-sync", zoneStats: [...]}) の両方に対応
        if data["zoneStats"] != nil {
            syncLog("[WSync:Recv] [\(channel)] stats snapshot received")
            NotificationCenter.default.post(
                name: .statsUpdatedFromiPhone,
                object: nil,
                userInfo: data
            )
        }

        // セッションライフサイクル（sendMessage + applicationContext 両対応）
        if let type = data["type"] as? String {
            switch type {
            case "session-start":
                syncLog("[WSync:Recv] [\(channel)] session-start → clearing dedup set")
                seenShotIds.removeAll()
                NotificationCenter.default.post(
                    name: .sessionStartedFromiPhone,
                    object: nil,
                    userInfo: data
                )
            case "session-end":
                syncLog("[WSync:Recv] [\(channel)] session-end")
                NotificationCenter.default.post(
                    name: .sessionEndedFromiPhone,
                    object: nil,
                    userInfo: data
                )
            default:
                break
            }
        }

        // applicationContext 経由のセッション復旧
        // (activeSessionId が存在 → セッション中、null → セッション終了)
        if let activeSessionId = data["activeSessionId"] as? String, !activeSessionId.isEmpty {
            syncLog("[WSync:Recv] [\(channel)] app-context session restore → \(activeSessionId)")
            NotificationCenter.default.post(
                name: .sessionStartedFromiPhone,
                object: nil,
                userInfo: data
            )
        }
    }
}

extension Notification.Name {
    static let zoneChangedFromiPhone = Notification.Name("zoneChangedFromiPhone")
    static let statsUpdatedFromiPhone = Notification.Name("statsUpdatedFromiPhone")
    static let shotReceivedFromiPhone = Notification.Name("shotReceivedFromiPhone")
    static let sessionStartedFromiPhone = Notification.Name("sessionStartedFromiPhone")
    static let sessionEndedFromiPhone = Notification.Name("sessionEndedFromiPhone")
}
