// CoreWLAN is used only by the embedded, user-authorized SMAppService agent.
import CoreWLAN
import Foundation
import Network

struct SitovPathPolicy {
    static func rejection(satisfied: Bool, expensive: Bool, constrained: Bool,
                          wifi: Bool, cellular: Bool, ethernet: Bool, loopback: Bool) -> String? {
        guard satisfied else { return "network_unavailable" }
        guard !expensive else { return "expensive_network" }
        guard !constrained else { return "constrained_network" }
        guard wifi && !cellular && !ethernet && !loopback else { return "wifi_required" }
        return nil
    }
    static func inspectSSIDs(_ ssids: [String?], allowed: Set<String>) -> SitovNetworkSnapshot {
        guard ssids.count <= 1 else { return .denied("wifi_interface_ambiguous") }
        guard let entry = ssids.first, let ssid = entry, !ssid.isEmpty else {
            return .denied("ssid_unavailable")
        }
        guard allowed.contains(ssid) else { return .denied("wifi_not_allowed") }
        return SitovNetworkSnapshot(eligible: true, reason: "allowed_wifi")
    }
}

func sitovInspectPath(_ path: NWPath, allowed: Set<String>) -> SitovNetworkSnapshot {
    if let reason = SitovPathPolicy.rejection(satisfied: path.status == .satisfied,
        expensive: path.isExpensive, constrained: path.isConstrained,
        wifi: path.usesInterfaceType(.wifi), cellular: path.usesInterfaceType(.cellular),
        ethernet: path.usesInterfaceType(.wiredEthernet), loopback: path.usesInterfaceType(.loopback)) {
        return .denied(reason)
    }
    let names = Set(path.availableInterfaces.filter { $0.type == .wifi }.map { $0.name })
    let associated = (CWWiFiClient.shared().interfaces() ?? []).filter {
        guard let name = $0.interfaceName else { return false }
        return names.contains(name) && $0.powerOn() && $0.serviceActive() && $0.interfaceMode() == .station
    }
    return SitovPathPolicy.inspectSSIDs(associated.map { $0.ssid() }, allowed: allowed)
}

func sitovNetworkSnapshot(allowed: Set<String>) -> SitovNetworkSnapshot {
    // Observe the default path; a Wi-Fi-only path could conceal another route.
    let monitor = NWPathMonitor()
    let ready = DispatchSemaphore(value: 0)
    let box = SitovSnapshotBox()
    monitor.pathUpdateHandler = { path in
        box.set(sitovInspectPath(path, allowed: allowed)); ready.signal()
    }
    monitor.start(queue: DispatchQueue(label: "sitov.backup.network-state"))
    let result = ready.wait(timeout: .now() + 2)
    monitor.cancel()
    guard result == .success, let snapshot = box.get() else { return .denied("network_check_timeout") }
    return snapshot
}
