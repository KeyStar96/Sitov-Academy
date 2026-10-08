// Local-only contract for the signed permission app, embedded agent and CLI.
import Foundation

let sitovWiFiMachService = "com.sitov.backup-wifi.network-agent"
let sitovWiFiAgentPlist = "com.sitov.backup-wifi.network-agent.plist"
let sitovWiFiPreviousAgentPlist = "com.sitov.backup-wifi.agent.plist"
let sitovWiFiBundleIdentifier = "com.sitov.backup-wifi"

struct SitovNetworkSnapshot: Codable, Sendable, Equatable {
    let eligible: Bool
    let reason: String
    static func denied(_ reason: String) -> Self { Self(eligible: false, reason: reason) }
    func json() -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let data = try? encoder.encode(self), let value = String(data: data, encoding: .utf8) else {
            return "{\"eligible\":false,\"reason\":\"network_guard_failed\"}"
        }
        return value
    }
}

@objc protocol SitovWiFiAgentProtocol {
    // No SSID, coordinates or arbitrary file requests pass through this API.
    func snapshot(withReply reply: @escaping (String) -> Void)
}

func sitovAllowedWiFiConfig() -> URL {
    URL(fileURLWithPath: NSHomeDirectory())
        .appendingPathComponent("Library/Application Support/Sitov Academy/Backups/allowed-wifi.json")
}

func sitovReadAllowedWiFi(_ url: URL) -> Result<Set<String>, SitovWiFiConfigError> {
    do {
        let values = try FileManager.default.attributesOfItem(atPath: url.path)
        guard values[.type] as? FileAttributeType == .typeRegular,
              let size = values[.size] as? NSNumber, size.intValue <= 65_536,
              let owner = values[.ownerAccountID] as? NSNumber, owner.uint32Value == getuid(),
              let permissions = values[.posixPermissions] as? NSNumber,
              permissions.intValue & 0o077 == 0 else { return .failure(.invalid) }
        let names = try JSONDecoder().decode([String].self, from: Data(contentsOf: url))
        guard !names.isEmpty else { return .failure(.missing) }
        guard names.count <= 128, names.allSatisfy({ !$0.isEmpty && $0.utf8.count <= 32 }) else {
            return .failure(.invalid)
        }
        return .success(Set(names))
    } catch { return .failure(.invalid) }
}

enum SitovWiFiConfigError: Error {
    case missing, invalid
    var reason: String { self == .missing ? "wifi_allowlist_missing" : "wifi_config_invalid" }
}

final class SitovSnapshotBox: @unchecked Sendable {
    private let lock = NSLock()
    private var value: SitovNetworkSnapshot?
    func set(_ snapshot: SitovNetworkSnapshot) {
        lock.lock(); defer { lock.unlock() }
        if value == nil { value = snapshot }
    }
    func get() -> SitovNetworkSnapshot? {
        lock.lock(); defer { lock.unlock() }
        return value
    }
}
