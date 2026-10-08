// The CLI requests a local decision from the signed app's embedded user agent.
// Apple DTS: https://developer.apple.com/forums/thread/759044
import Foundation

@main
struct SitovNetworkGuard {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        let result: SitovNetworkSnapshot
        if args.isEmpty { result = .denied("wifi_allowlist_missing") }
        else if args.count != 2 || args[0] != "--allowed-wifi-config" { result = .denied("invalid_arguments") }
        else { result = check(config: args[1]) }
        print(result.json())
    }
    static func check(config: String) -> SitovNetworkSnapshot {
        let url = URL(fileURLWithPath: config).standardizedFileURL
        switch sitovReadAllowedWiFi(url) {
        case .failure(let error): return .denied(error.reason)
        case .success: break
        }
        guard url.path == sitovAllowedWiFiConfig().standardizedFileURL.path else {
            return .denied("wifi_config_invalid")
        }
        let connection = NSXPCConnection(machServiceName: sitovWiFiMachService)
        connection.remoteObjectInterface = NSXPCInterface(with: SitovWiFiAgentProtocol.self)
        let ready = DispatchSemaphore(value: 0)
        let box = SitovSnapshotBox()
        connection.invalidationHandler = { box.set(.denied("wifi_agent_unavailable")); ready.signal() }
        connection.interruptionHandler = { box.set(.denied("wifi_agent_unavailable")); ready.signal() }
        connection.resume()
        let proxy = connection.remoteObjectProxyWithErrorHandler { _ in
            box.set(.denied("wifi_agent_unavailable")); ready.signal()
        }
        guard let service = proxy as? SitovWiFiAgentProtocol else {
            connection.invalidate(); return .denied("wifi_agent_unavailable")
        }
        service.snapshot { json in
            if json.utf8.count <= 1024,
               let data = json.data(using: .utf8),
               let value = try? JSONDecoder().decode(SitovNetworkSnapshot.self, from: data),
               !value.eligible || value.reason == "allowed_wifi" {
                box.set(value)
            } else { box.set(.denied("network_guard_failed")) }
            ready.signal()
        }
        let result = ready.wait(timeout: .now() + 4)
        connection.invalidate()
        guard result == .success, let value = box.get() else { return .denied("network_check_timeout") }
        return value
    }
}
