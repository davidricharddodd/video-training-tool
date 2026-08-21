import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execPromise = promisify(exec);

async function getDuration(path) {
  const { stdout } = await execPromise(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`
  );
  return parseFloat(stdout.trim());
}

async function run() {
  const videoUrl = "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/tys/gt.mp4";
  console.log("Checking duration of tys video...");
  const duration = await getDuration(videoUrl);
  console.log("tys Video Duration:", duration);

  const targetDuration = 12.0; // 12 seconds
  const N = Math.ceil(targetDuration / duration) - 1;
  console.log(`Need to loop ${N} times (total loops = ${N + 1} plays)`);

  if (N > 0) {
    console.log("Looping video...");
    // Loop the remote video URL directly! ffmpeg can read remote URLs!
    const outputFilename = "tys_looped.mp4";
    await execPromise(
      `ffmpeg -y -stream_loop ${N} -i "${videoUrl}" -c copy ${outputFilename}`
    );
    console.log("Loop complete!");

    const newDuration = await getDuration(outputFilename);
    console.log("New Looped Video Duration:", newDuration);

    // Clean up
    if (fs.existsSync(outputFilename)) {
      fs.unlinkSync(outputFilename);
      console.log("Cleaned up looped file.");
    }
  }
}

run().catch(console.error);
