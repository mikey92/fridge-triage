// Prints what VoiceOver is saying, read from its caption panel: finds the panel window (owned by the VoiceOver
// process), captures only that window with screencapture, and reads it with the Vision text recognizer.
//   vo-caption            → the caption text on one line ("" when no panel is showing)
import AppKit
import Foundation
import Vision

func captionWindowId() -> Int? {
  guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return nil }
  let panels = list.filter { ($0[kCGWindowOwnerName as String] as? String) == "VoiceOver" }
  // The caption panel is the widest VoiceOver window that is wider than it is tall, leaving out the screen-wide window
  // VoiceOver draws its cursor in.
  let sized = panels.compactMap { info -> (Int, CGFloat)? in
    guard let id = info[kCGWindowNumber as String] as? Int,
          let bounds = info[kCGWindowBounds as String] as? [String: CGFloat],
          let w = bounds["Width"], let h = bounds["Height"], w > h, h > 20, w < 2000 else { return nil }
    return (id, w)
  }
  return sized.max { $0.1 < $1.1 }?.0
}

guard let id = captionWindowId() else {
  print("")
  exit(0)
}
let path = "/tmp/vo-caption.png"
let task = Process()
task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
task.arguments = ["-x", "-o", "-l", String(id), path]
try task.run()
task.waitUntilExit()
guard let image = NSImage(contentsOfFile: path),
      let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  print("")
  exit(0)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["ko-KR", "en-US"]
request.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: cg).perform([request])
let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
print(lines.joined(separator: " "))
