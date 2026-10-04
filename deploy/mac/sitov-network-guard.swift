// Build outside Git with: xcrun swiftc -parse-as-library -O <source> -o <private Tools>/sitov-network-guard
// These APIs only inspect the local network; they do not open a remote connection.
// https://developer.apple.com/documentation/network/nwpath/isexpensive
// https://developer.apple.com/documentation/network/nwpath/isconstrained
// https://developer.apple.com/documentation/corewlan/cwinterface/ssid()
import CoreWLAN
import Foundation
import Network

struct SitovNetworkSnapshot: Codable, Sendable {
    let eligible: Bool
    let reason: String
}

final class SitovSnapshotBox: @unchecked Sendable {
    private let lock = NSLock()
    private var value: SitovNetworkSnapshot?

    func set(_ snapshot: SitovNetworkSnapshot) {
        lock.lock()
        defer { lock.unlock() }
        if value == nil { value = snapshot }
    }

    func get() -> SitovNetworkSnapshot? {
        lock.lock()
        defer { lock.unlock() }
        return value
    }
}

func sitovInspectPath(_ path: NWPath, allowed: Set<String>) -> SitovNetworkSnapshot {
    func skip(_ reason: String) -> SitovNetworkSnapshot {
        SitovNetworkSnapshot(eligible: false, reason: reason)
    }
    guard path.status == .satisfied else { return skip("network_unavailable") }
    guard !path.isExpensive else { return skip("expensive_network") }
    guard !path.isConstrained else { return skip("constrained_network") }
    guard path.usesInterfaceType(.wifi),
          !path.usesInterfaceType(.cellular),
          !path.usesInterfaceType(.wiredEthernet),
          !path.usesInterfaceType(.loopback) else { return skip("wifi_required") }

    let names = Set(path.availableInterfaces.filter { $0.type == .wifi }.map { $0.name })
    let client = CWWiFiClient.shared()
    let associated = (client.interfaces() ?? []).filter {
        guard let name = $0.interfaceName else { return false }
        return names.contains(name) && $0.powerOn() && $0.serviceActive() && $0.interfaceMode() == .station
    }
    // CoreWLAN supplies actual WLAN interfaces rather than virtual peer-to-peer
    // adapters from NWPath. Every participating radio must identify an allowed SSID.
    guard !associated.isEmpty else { return skip("ssid_unavailable") }
    for interface in associated {
        guard let ssid = interface.ssid(), !ssid.isEmpty else { return skip("ssid_unavailable") }
        guard allowed.contains(ssid) else { return skip("wifi_not_allowed") }
    }
    return SitovNetworkSnapshot(eligible: true, reason: "allowed_wifi")
}

@main
struct SitovNetworkGuard {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        let snapshot: SitovNetworkSnapshot
        if args.isEmpty {
            snapshot = SitovNetworkSnapshot(eligible: false, reason: "wifi_allowlist_missing")
        } else if args.count != 2 || args[0] != "--allowed-wifi-config" {
            snapshot = SitovNetworkSnapshot(eligible: false, reason: "invalid_arguments")
        } else {
            snapshot = check(config: args[1])
        }
        // Never print SSIDs, BSSIDs, interface names, permission details or file contents.
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        if let data = try? encoder.encode(snapshot), let json = String(data: data, encoding: .utf8) {
            print(json)
        } else {
            print("{\"eligible\":false,\"reason\":\"network_guard_failed\"}")
        }
    }

    static func check(config: String) -> SitovNetworkSnapshot {
        let allowed: Set<String>
        do {
            let url = URL(fileURLWithPath: config)
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            guard attributes[.type] as? FileAttributeType == .typeRegular,
                  let size = attributes[.size] as? NSNumber, size.intValue <= 65_536 else {
                return SitovNetworkSnapshot(eligible: false, reason: "wifi_config_invalid")
            }
            let names = try JSONDecoder().decode([String].self, from: Data(contentsOf: url))
            guard !names.isEmpty else {
                return SitovNetworkSnapshot(eligible: false, reason: "wifi_allowlist_missing")
            }
            guard names.count <= 128,
                  names.allSatisfy({ !$0.isEmpty && $0.utf8.count <= 32 }) else {
                return SitovNetworkSnapshot(eligible: false, reason: "wifi_config_invalid")
            }
            allowed = Set(names)
        } catch {
            return SitovNetworkSnapshot(eligible: false, reason: "wifi_config_invalid")
        }

        // Observe the default path, not a Wi-Fi-only monitor that could hide a
        // simultaneous cellular/ethernet route. Wait only for its initial snapshot.
        let monitor = NWPathMonitor()
        let ready = DispatchSemaphore(value: 0)
        let box = SitovSnapshotBox()
        monitor.pathUpdateHandler = { path in
            box.set(sitovInspectPath(path, allowed: allowed))
            ready.signal()
        }
        monitor.start(queue: DispatchQueue(label: "sitov.backup.network-guard"))
        let result = ready.wait(timeout: .now() + 3)
        monitor.cancel()
        guard result == .success, let snapshot = box.get() else {
            return SitovNetworkSnapshot(eligible: false, reason: "network_check_timeout")
        }
        return snapshot
    }
}
