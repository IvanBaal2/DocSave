import ExpoModulesCore
import Foundation
import MachO

public class DocsaveSecurityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DocsaveSecurity")

    // Marks a file or directory as excluded from iCloud / computer backups.
    Function("excludeFromBackup") { (uri: String) -> Bool in
      guard var url = Self.fileURL(from: uri) else { return false }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
        return true
      } catch {
        return false
      }
    }

    // Heuristic jailbreak / instrumentation detection. No check is bulletproof:
    // a sufficiently privileged attacker can hide every indicator.
    Function("checkIntegrity") { () -> [String: Any] in
      var reasons: [String] = []
      var emulator = false

      #if targetEnvironment(simulator)
      emulator = true
      #else
      let suspiciousPaths = [
        "/Applications/Cydia.app",
        "/Applications/Sileo.app",
        "/Applications/Zebra.app",
        "/Library/MobileSubstrate/MobileSubstrate.dylib",
        "/usr/lib/libsubstrate.dylib",
        "/usr/lib/TweakInject",
        "/bin/bash",
        "/usr/sbin/sshd",
        "/etc/apt",
        "/private/var/lib/apt/",
        "/var/jb",
        "/private/preboot/jb",
        "/usr/bin/ssh",
      ]
      for path in suspiciousPaths where FileManager.default.fileExists(atPath: path) {
        reasons.append("path:\(path)")
      }

      // A sandboxed app must not be able to write outside its container.
      let probe = "/private/docsave_probe_\(UUID().uuidString)"
      do {
        try "x".write(toFile: probe, atomically: true, encoding: .utf8)
        try? FileManager.default.removeItem(atPath: probe)
        reasons.append("sandbox-writable")
      } catch {}

      if let inserted = getenv("DYLD_INSERT_LIBRARIES"), strlen(inserted) > 0 {
        reasons.append("dyld-insert-libraries")
      }

      let hookLibraries = ["frida", "cynject", "libcycript", "substrate", "substitute", "ellekit"]
      for i in 0..<_dyld_image_count() {
        if let cName = _dyld_get_image_name(i) {
          let name = String(cString: cName).lowercased()
          if let hit = hookLibraries.first(where: { name.contains($0) }) {
            reasons.append("dylib:\(hit)")
          }
        }
      }
      #endif

      return [
        "compromised": !reasons.isEmpty,
        "emulator": emulator,
        "reasons": reasons,
      ]
    }
  }

  private static func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }
    return URL(fileURLWithPath: uri)
  }
}
