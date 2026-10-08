// User-visible owner of Location permission and the embedded Wi-Fi user agent.
// No location updates or coordinates are requested, collected or transmitted.
import AppKit
import CoreLocation
import CoreServices
import ServiceManagement

final class SitovWiFiPermissionDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDelegate {
    private var window: NSWindow!
    private let manager = CLLocationManager()
    private let service = SMAppService.agent(plistName: sitovWiFiAgentPlist)
    private let status = NSTextField(wrappingLabelWithString: "")
    func applicationDidFinishLaunching(_ notification: Notification) {
        manager.delegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 540, height: 340),
                          styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = "Sitov Academy · Backup-WLAN"
        window.center()
        let title = NSTextField(labelWithString: "Sicherungen nur im erlaubten WLAN")
        title.font = .boldSystemFont(ofSize: 21)
        let explanation = NSTextField(wrappingLabelWithString:
            "macOS verlangt eine Standortberechtigung, um den Namen des verbundenen WLANs zu prüfen. Sitov Academy verwendet sie ausschließlich für die lokale WLAN-Freigabe deiner Sicherungen. Standortkoordinaten werden weder erfasst noch übertragen.")
        explanation.font = .systemFont(ofSize: 14)
        let limits = NSTextField(wrappingLabelWithString:
            "Downloads bleiben bei Handy-Hotspots, eingeschränkten Verbindungen, Ethernet und unbekannten WLANs gesperrt. Die Sicherungen bleiben auf deinem Mac; auf dem VPS verbleibt die letzte vollständige Version.")
        limits.font = .systemFont(ofSize: 13)
        status.font = .systemFont(ofSize: 13, weight: .medium)
        let enable = NSButton(title: "WLAN-Freigabe einrichten", target: self, action: #selector(enableAccess))
        enable.bezelStyle = .rounded
        enable.keyEquivalent = "\r"
        let settings = NSButton(title: "Standort-Einstellungen", target: self, action: #selector(openLocationSettings))
        settings.bezelStyle = .rounded
        let buttons = NSStackView(views: [enable, settings])
        buttons.orientation = .horizontal
        buttons.spacing = 12
        let stack = NSStackView(views: [title, explanation, limits, status, buttons])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        window.contentView!.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 26),
            stack.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -26),
            stack.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 26),
        ])
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        updateStatus()
        if CommandLine.arguments.contains("--setup") { enableAccess() }
    }
    @objc private func enableAccess() {
        do {
            if service.status != .enabled && service.status != .requiresApproval { try service.register() }
        } catch {
            status.stringValue = "Der Hintergrunddienst konnte nicht aktiviert werden. Bitte die App erneut öffnen."; return
        }
        if service.status == .requiresApproval { SMAppService.openSystemSettingsLoginItems() }
        manager.requestWhenInUseAuthorization()
        updateStatus()
    }
    @objc private func openLocationSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices") {
            NSWorkspace.shared.open(url)
        }
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) { updateStatus() }
    private func updateStatus() {
        guard CLLocationManager.locationServicesEnabled() else {
            status.stringValue = "Standortdienste sind ausgeschaltet. Backup-Downloads bleiben gesperrt."; return
        }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            status.stringValue = service.status == .enabled
                ? "WLAN-Prüfung eingerichtet. Die Freigabeliste wird vor jedem Abruf geprüft."
                : "Standortzugriff erlaubt. Bitte noch den Hintergrunddienst aktivieren."
        case .notDetermined:
            status.stringValue = "Bitte die WLAN-Freigabe einrichten und den macOS-Dialog bestätigen."
        default:
            status.stringValue = "Standortzugriff gesperrt. In den Einstellungen „Sitov Academy Backup-WLAN“ erlauben."
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@main
struct SitovWiFiPermissionApp {
    static func main() {
        // Register the final installed bundle, not the installer's staging URL.
        _ = LSRegisterURL(Bundle.main.bundleURL as CFURL, true)
        if CommandLine.arguments.contains("--agent") {
            let app = NSApplication.shared
            app.setActivationPolicy(.prohibited)
            SitovWiFiAgentMain.run { app.run() }
            return
        }
        if CommandLine.arguments.contains("--refresh-agent") {
            let service = SMAppService.agent(plistName: sitovWiFiAgentPlist)
            let register = {
                do {
                    try service.register()
                    print("{\"agentStatus\":\(service.status.rawValue)}")
                } catch { print("{\"agentRegistrationFailed\":true}") }
                exit(0)
            }
            let refresh = {
                if service.status == .enabled || service.status == .requiresApproval {
                    service.unregister { error in
                        if error == nil { register() }
                        else { print("{\"agentRegistrationFailed\":true}"); exit(0) }
                    }
                } else { register() }
            }
            let previous = SMAppService.agent(plistName: sitovWiFiPreviousAgentPlist)
            if previous.status == .enabled || previous.status == .requiresApproval {
                previous.unregister { error in
                    if error == nil { refresh() }
                    else { print("{\"agentRegistrationFailed\":true}"); exit(0) }
                }
            } else { refresh() }
            RunLoop.main.run()
            return
        }
        if CommandLine.arguments.contains("--agent-status") {
            let value = SMAppService.agent(plistName: sitovWiFiAgentPlist).status.rawValue
            print("{\"agentStatus\":\(value)}")
            return
        }
        let app = NSApplication.shared
        let delegate = SitovWiFiPermissionDelegate()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}
