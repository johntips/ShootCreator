import SwiftUI

@main
struct ShootCreaterWatch: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(WatchConnectivityManager.shared)
                .environmentObject(SessionState())
        }
    }
}
