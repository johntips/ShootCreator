import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: SessionState
    @State private var showZones = true

    var body: some View {
        NavigationStack {
            if showZones {
                ZoneMapView(onSelect: { zoneId in
                    session.selectedZoneId = zoneId
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
