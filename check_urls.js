

const urls = [
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo1_video.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo2_video.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo3_video.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo4_video.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo5_video.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo1_input.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo2_input.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo3_input.mp4",
  "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo4_input.mp4",
];

async function check() {
  console.log("Checking LatentSync repository asset URLs...");
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      console.log(`${url} -> Status: ${res.status}`);
    } catch (err) {
      console.log(`${url} -> Error: ${err.message}`);
    }
  }
}

check();
