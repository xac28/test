// @tensorflow-models/pose-detection imports `Pose` from @mediapipe/pose, a script that sets a browser global and has no ES exports,
// which Turbopack refuses to bundle. AYA only uses the tfjs runtime (MoveNet), never MediaPipe's own, so an empty stand-in is enough.
export class Pose {
  constructor() {
    throw new Error("The MediaPipe runtime is not bundled; use the tfjs runtime.")
  }
}
