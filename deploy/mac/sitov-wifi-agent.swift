import CoreLocation
import Foundation

final class SitovWiFiAgent: NSObject, NSXPCListenerDelegate, SitovWiFiAgentProtocol {
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        guard connection.effectiveUserIdentifier == getuid() else { return false }
        connection.exportedInterface = NSXPCInterface(with: SitovWiFiAgentProtocol.self)
        connection.exportedObject = self
        connection.resume()
        return true
    }
    func snapshot(withReply reply: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            guard CLLocationManager.locationServicesEnabled() else {
                reply(SitovNetworkSnapshot.denied("location_services_disabled").json()); return
            }
            // CoreWLAN checks the responsible container app's OS privilege.
            // CLLocationManager on a bare embedded executable can report its
            // own .notDetermined status even when the responsible app is allowed.
            // Never override that OS boundary: an unavailable SSID stays denied.
            switch sitovReadAllowedWiFi(sitovAllowedWiFiConfig()) {
            case .failure(let error): reply(SitovNetworkSnapshot.denied(error.reason).json())
            case .success(let allowed):
                DispatchQueue.global(qos: .utility).async { reply(sitovNetworkSnapshot(allowed: allowed).json()) }
            }
        }
    }
}

struct SitovWiFiAgentMain {
    static func run(_ runLoop: () -> Void) {
        let delegate = SitovWiFiAgent()
        let listener = NSXPCListener(machServiceName: sitovWiFiMachService)
        listener.delegate = delegate
        listener.resume()
        withExtendedLifetime((listener, delegate)) { runLoop() }
    }
}
