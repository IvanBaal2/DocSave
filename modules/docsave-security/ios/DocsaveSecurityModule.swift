import CommonCrypto
import CryptoKit
import ExpoModulesCore
import Foundation
import MachO
import UIKit
import Vision

private let MAGIC = Data([0x44, 0x53, 0x56, 0x31]) // "DSV1"
private let NONCE_BYTES = 12
private let HEADER_BYTES = 16
private let TAG_BYTES = 16

final class TamperException: Exception {
  override var code: String { "ERR_TAMPER" }
  override var reason: String { "Integrity check failed" }
}

final class FormatException: Exception {
  override var code: String { "ERR_FORMAT" }
  override var reason: String { "Not a Docsave encrypted object" }
}

final class MissingFileException: Exception {
  override var code: String { "ERR_MISSING" }
  override var reason: String { "Encrypted file is missing" }
}

final class ImageException: Exception {
  override var code: String { "ERR_IMAGE" }
  override var reason: String { "The image could not be decoded" }
}

final class CryptoFailureException: GenericException<String> {
  override var code: String { "ERR_CRYPTO" }
  override var reason: String { "Cryptographic operation failed: \(param)" }
}

public class DocsaveSecurityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DocsaveSecurity")

    // Crash reports on iOS are collected by the system (Settings → Privacy → Analytics).
    Function("readLastCrash") { () -> String? in nil }
    Function("clearLastCrash") { () -> Bool in true }

    // Marks a file or directory as excluded from iCloud / computer backups.
    Function("excludeFromBackup") { (uri: String) -> Bool in
      var url = Self.fileURL(from: uri)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
        return true
      } catch {
        return false
      }
    }

    // Heuristic jailbreak / instrumentation detection. No check is bulletproof.
    Function("checkIntegrity") { () -> [String: Any] in
      var reasons: [String] = []
      var emulator = false

      #if targetEnvironment(simulator)
      emulator = true
      #else
      let suspiciousPaths = [
        "/Applications/Cydia.app", "/Applications/Sileo.app", "/Applications/Zebra.app",
        "/Library/MobileSubstrate/MobileSubstrate.dylib", "/usr/lib/libsubstrate.dylib",
        "/usr/lib/TweakInject", "/bin/bash", "/usr/sbin/sshd", "/etc/apt",
        "/private/var/lib/apt/", "/var/jb", "/private/preboot/jb", "/usr/bin/ssh",
      ]
      for path in suspiciousPaths where FileManager.default.fileExists(atPath: path) {
        reasons.append("path:\(path)")
      }
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

      return ["compromised": !reasons.isEmpty, "emulator": emulator, "reasons": reasons]
    }

    // ── Cryptography (CommonCrypto / CryptoKit) ─────────────────────────────

    AsyncFunction("pbkdf2Sha256") { (password: String, saltB64: String, iterations: Int, length: Int) throws -> String in
      guard let salt = Data(base64Encoded: saltB64) else { throw CryptoFailureException("salt") }
      var derived = [UInt8](repeating: 0, count: length)
      let pw = Array(password.utf8)
      let status = salt.withUnsafeBytes { saltPtr in
        CCKeyDerivationPBKDF(
          CCPBKDFAlgorithm(kCCPBKDF2),
          pw.map { Int8(bitPattern: $0) }, pw.count,
          saltPtr.bindMemory(to: UInt8.self).baseAddress, salt.count,
          CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
          UInt32(iterations),
          &derived, length
        )
      }
      guard status == kCCSuccess else { throw CryptoFailureException("pbkdf2") }
      defer { derived.withUnsafeMutableBytes { $0.initializeMemory(as: UInt8.self, repeating: 0) } }
      return Data(derived).base64EncodedString()
    }

    AsyncFunction("sealToFile") { (keyB64: String, aad: String, dataB64: String, path: String) throws -> Int in
      guard let key = Data(base64Encoded: keyB64), let data = Data(base64Encoded: dataB64) else {
        throw CryptoFailureException("input")
      }
      let sealed = try Self.seal(key: key, aad: Data(aad.utf8), plain: data)
      try Self.writeAtomic(path: path, data: sealed)
      return sealed.count
    }

    AsyncFunction("sealFileToFile") { (keyB64: String, aad: String, inPath: String, outPath: String) throws -> [String: Any] in
      guard let key = Data(base64Encoded: keyB64) else { throw CryptoFailureException("key") }
      let plain = try Data(contentsOf: Self.fileURL(from: inPath))
      let sealed = try Self.seal(key: key, aad: Data(aad.utf8), plain: plain)
      try Self.writeAtomic(path: outPath, data: sealed)
      return ["size": plain.count, "head": plain.prefix(16).base64EncodedString()]
    }

    AsyncFunction("openFile") { (keyB64: String, aad: String, path: String) throws -> String in
      guard let key = Data(base64Encoded: keyB64) else { throw CryptoFailureException("key") }
      let url = Self.fileURL(from: path)
      guard FileManager.default.fileExists(atPath: url.path) else { throw MissingFileException() }
      let blob = try Data(contentsOf: url)
      return try Self.open(key: key, aad: Data(aad.utf8), blob: blob).base64EncodedString()
    }

    // ── On-device text recognition (Apple Vision, no network) ──────────────

    AsyncFunction("recognizeText") { (imageB64: String, maxDim: Int, rotation: Int, promise: Promise) in
      guard let data = Data(base64Encoded: imageB64), let image = Self.upright(UIImage(data: data), maxDim: maxDim),
            let cg = image.cgImage else {
        promise.reject(ImageException())
        return
      }
      let width = cg.width
      let height = cg.height
      let request = VNRecognizeTextRequest { req, error in
        if let error = error {
          promise.reject(CryptoFailureException("ocr: \(error.localizedDescription)"))
          return
        }
        let observations = (req.results as? [VNRecognizedTextObservation]) ?? []
        let lines: [[String: Any]] = observations.compactMap { obs in
          guard let text = obs.topCandidates(1).first?.string else { return nil }
          let box = obs.boundingBox
          return [
            "text": text,
            "x": Int(box.minX * CGFloat(width)),
            "y": Int((1 - box.maxY) * CGFloat(height)),
            "w": Int(box.width * CGFloat(width)),
            "h": Int(box.height * CGFloat(height)),
          ]
        }
        promise.resolve(["width": width, "height": height, "lines": lines])
      }
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let orientation: CGImagePropertyOrientation
          switch ((rotation % 360) + 360) % 360 {
          case 90: orientation = .right
          case 180: orientation = .down
          case 270: orientation = .left
          default: orientation = .up
          }
          try VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:]).perform([request])
        } catch {
          promise.reject(CryptoFailureException("ocr: \(error.localizedDescription)"))
        }
      }
    }

    AsyncFunction("cropJpeg") { (imageB64: String, x: Double, y: Double, w: Double, h: Double, quality: Double, maxDim: Int, rotation: Int) throws -> String in
      guard let data = Data(base64Encoded: imageB64), let image = Self.upright(UIImage(data: data), maxDim: maxDim),
            let cg = image.cgImage else { throw ImageException() }
      let W = Double(cg.width), H = Double(cg.height)
      let left = max(0, min(1, x)) * W
      let top = max(0, min(1, y)) * H
      let rect = CGRect(
        x: left, y: top,
        width: max(1, min(W - left, max(0, min(1, w)) * W)),
        height: max(1, min(H - top, max(0, min(1, h)) * H))
      ).integral
      guard let cropped = cg.cropping(to: rect) else { throw ImageException() }
      // Rotate clockwise so the document is upright.
      let orientation: UIImage.Orientation
      switch ((rotation % 360) + 360) % 360 {
      case 90: orientation = .right
      case 180: orientation = .down
      case 270: orientation = .left
      default: orientation = .up
      }
      let oriented = Self.upright(UIImage(cgImage: cropped, scale: 1, orientation: orientation)) ?? UIImage(cgImage: cropped)
      guard let jpeg = oriented.jpegData(compressionQuality: CGFloat(max(0.3, min(1, quality)))) else {
        throw ImageException()
      }
      return jpeg.base64EncodedString()
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static func seal(key: Data, aad: Data, plain: Data) throws -> Data {
    guard key.count == 32 else { throw CryptoFailureException("key length") }
    let box = try AES.GCM.seal(plain, using: SymmetricKey(data: key), nonce: AES.GCM.Nonce(), authenticating: aad)
    var out = Data()
    out.append(MAGIC)
    out.append(contentsOf: box.nonce)
    out.append(box.ciphertext)
    out.append(box.tag)
    return out
  }

  private static func open(key: Data, aad: Data, blob: Data) throws -> Data {
    guard blob.count >= HEADER_BYTES + TAG_BYTES, blob.prefix(4) == MAGIC else { throw FormatException() }
    let bytes = [UInt8](blob)
    do {
      let nonce = try AES.GCM.Nonce(data: Data(bytes[4..<HEADER_BYTES]))
      let ct = Data(bytes[HEADER_BYTES..<(bytes.count - TAG_BYTES)])
      let tag = Data(bytes[(bytes.count - TAG_BYTES)...])
      let box = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ct, tag: tag)
      return try AES.GCM.open(box, using: SymmetricKey(data: key), authenticating: aad)
    } catch {
      throw TamperException()
    }
  }

  private static func writeAtomic(path: String, data: Data) throws {
    let url = fileURL(from: path)
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try data.write(to: url, options: [.atomic, .completeFileProtection])
  }

  /// Redraws the image so pixel data matches its display orientation, and
  /// downscales it so the longest side is at most maxDim (0 = no limit).
  private static func upright(_ image: UIImage?, maxDim: Int = 0) -> UIImage? {
    guard let image = image else { return nil }
    let longest = max(image.size.width, image.size.height)
    let scale = (maxDim > 0 && longest > CGFloat(maxDim)) ? CGFloat(maxDim) / longest : 1
    if image.imageOrientation == .up && scale == 1 { return image }
    let size = CGSize(width: floor(image.size.width * scale), height: floor(image.size.height * scale))
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: size))
    }
  }

  private static func fileURL(from uri: String) -> URL {
    if uri.hasPrefix("file://"), let url = URL(string: uri) { return url }
    return URL(fileURLWithPath: uri)
  }
}
